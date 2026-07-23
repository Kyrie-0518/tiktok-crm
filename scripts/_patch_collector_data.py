"""Fix growth-center collector to use real TikTok API for ads and traffic"""
with open(r'f:\tiktok-crm-dev\server\src\services\growth-center\collector.ts', 'r', encoding='utf-8') as f:
    c = f.read()

# Fix collectAds
old_ads = """async function collectAds(shopCipher: string): Promise<AdSnapshot[]> {
  try {
    const db = getDb();
    const ads = db.prepare('SELECT * FROM ad_campaigns WHERE shop_id = ? ORDER BY updated_at DESC LIMIT 50').all(shopCipher) as any[];
    return (ads || []).map((a: any) => ({
      campaign_id: a.campaign_id || '', campaign_name: a.campaign_name || '',
      adgroup_id: a.adgroup_id || '', adgroup_name: a.adgroup_name || '',
      creative_id: a.creative_id || '',
      status: a.status || '', budget: a.budget || 0, spend: a.spend || 0,
      impressions: a.impressions || 0, clicks: a.clicks || 0,
      ctr: a.ctr || 0, cpm: a.cpm || 0, cpc: a.cpc || 0, cpa: a.cpa || 0, cvr: a.cvr || 0,
      orders: a.orders || 0, gmv: a.gmv || 0, roas: a.roas || 0,
      learning_phase: a.learning_phase || '', review_status: a.review_status || '',
      start_time: a.start_time || '', end_time: a.end_time || '',
    }));
  } catch (e: any) { console.warn('[Collector] ads:', e.message); return []; }
}"""

new_ads = """async function collectAds(shopCipher: string, days: number = 7): Promise<AdSnapshot[]> {
  // 直接调 TikTok Ads API（不走本地缓存，避免数据假/过时）
  try {
    const db = getDb();
    const adAcc = db.prepare("SELECT * FROM ad_accounts WHERE shop_id = ? AND status = 'enabled' LIMIT 1").get(shopCipher) as any;
    const advertiserId = adAcc?.advertiser_id || '';
    const token = adAcc?.access_token || '';
    const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);
    const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?advertiser_id=${advertiserId}&report_type=BASIC&data_level=AUCTION_AD&dimensions=["campaign_id","adgroup_id"]&metrics=["spend","impressions","clicks","ctr","cpm","cpc","complete_payment","complete_payment_rate","cost_per_complete_payment"]&start_date=${startDate}&end_date=${endDate}&page_size=1000`;
    const { fetchWithProxy } = await import('../tiktok-api');
    const res: any = await fetchWithProxy(url, { method: 'GET', headers: { 'Access-Token': token } });
    const list = res?.data?.data?.list || res?.data?.list || [];
    const campaigns = db.prepare('SELECT campaign_id, campaign_name, status FROM ad_campaigns WHERE shop_id = ?').all(shopCipher) as any[];
    const cmpMap = new Map(campaigns.map((c: any) => [c.campaign_id, c]));
    return list.map((row: any) => {
      const cmp: any = cmpMap.get(row.campaign_id) || {};
      const m = row.metrics || {};
      return {
        campaign_id: row.campaign_id || '', campaign_name: cmp.campaign_name || '',
        adgroup_id: row.adgroup_id || '', adgroup_name: '',
        creative_id: '',
        status: cmp.status || '',
        budget: 0, spend: parseFloat(m.spend || 0),
        impressions: parseInt(m.impressions || 0),
        clicks: parseInt(m.clicks || 0),
        ctr: parseFloat(m.ctr || 0), cpm: parseFloat(m.cpm || 0),
        cpc: parseFloat(m.cpc || 0), cpa: parseFloat(m.cost_per_complete_payment || 0),
        cvr: parseFloat(m.complete_payment_rate || 0),
        orders: parseInt(m.complete_payment || 0),
        gmv: 0, roas: 0,
        learning_phase: '', review_status: '',
        start_time: startDate, end_time: endDate,
      };
    });
  } catch (e: any) { console.warn('[Collector] ads (live API failed):', e.message); return []; }
}"""

c = c.replace(old_ads, new_ads)

# Fix collectTraffic
old_traf = """async function collectTraffic(shopCipher: string, days: number): Promise<TrafficSnapshot> {
  try {
    const db = getDb();
    const row = db.prepare('SELECT * FROM shop_performance WHERE shop_id = ? ORDER BY date DESC LIMIT 1').get(shopCipher) as any;
    if (row) {
      return {
        total_impressions: row.impressions || 0, total_clicks: row.clicks || 0,
        ctr: row.ctr || 0, pv: row.pv || 0, uv: row.uv || 0,
        search_traffic: row.search_traffic || 0, recommend_traffic: row.recommend_traffic || 0,
        marketplace_traffic: row.marketplace_traffic || 0, affiliate_traffic: row.affiliate_traffic || 0,
        live_traffic: row.live_traffic || 0, ads_traffic: row.ads_traffic || 0,
        external_traffic: row.external_traffic || 0, organic_traffic: row.organic_traffic || 0,
        trend: 'stable',
      };
    }
  } catch (e: any) { console.warn('[Collector] traffic:', e.message); }
  return { total_impressions: 0, total_clicks: 0, ctr: 0, pv: 0, uv: 0, search_traffic: 0, recommend_traffic: 0, marketplace_traffic: 0, affiliate_traffic: 0, live_traffic: 0, ads_traffic: 0, external_traffic: 0, organic_traffic: 0, trend: 'stable' };
}"""

new_traf = """async function collectTraffic(shopCipher: string, days: number): Promise<TrafficSnapshot> {
  // 直接调 TikTok Analytics API（不走本地缓存）
  try {
    const db = getDb();
    const adAcc = db.prepare("SELECT * FROM ad_accounts WHERE shop_id = ? AND status = 'enabled' LIMIT 1").get(shopCipher) as any;
    const advertiserId = adAcc?.advertiser_id || '';
    const token = adAcc?.access_token || '';
    const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
    const endDate = new Date().toISOString().slice(0, 10);
    const url = `https://business-api.tiktok.com/open_api/v1.3/report/integrated/get/?advertiser_id=${advertiserId}&report_type=BASIC&data_level=SHOP&dimensions=["stat_time_day"]&metrics=["impressions","clicks","ctr","page_view","unique_page_view"]&start_date=${startDate}&end_date=${endDate}&page_size=30`;
    const { fetchWithProxy } = await import('../tiktok-api');
    const res: any = await fetchWithProxy(url, { method: 'GET', headers: { 'Access-Token': token } });
    const list = res?.data?.data?.list || res?.data?.list || [];
    if (list.length === 0) return { total_impressions: 0, total_clicks: 0, ctr: 0, pv: 0, uv: 0, search_traffic: 0, recommend_traffic: 0, marketplace_traffic: 0, affiliate_traffic: 0, live_traffic: 0, ads_traffic: 0, external_traffic: 0, organic_traffic: 0, trend: 'stable' };
    const latest = list[list.length - 1] || {};
    const m = latest.metrics || {};
    return {
      total_impressions: parseInt(m.impressions || 0),
      total_clicks: parseInt(m.clicks || 0),
      ctr: parseFloat(m.ctr || 0),
      pv: parseInt(m.page_view || 0),
      uv: parseInt(m.unique_page_view || 0),
      search_traffic: 0, recommend_traffic: 0, marketplace_traffic: 0, affiliate_traffic: 0,
      live_traffic: 0, ads_traffic: parseInt(m.clicks || 0), external_traffic: 0,
      organic_traffic: 0, trend: 'stable',
    };
  } catch (e: any) { console.warn('[Collector] traffic (live API failed):', e.message); return { total_impressions: 0, total_clicks: 0, ctr: 0, pv: 0, uv: 0, search_traffic: 0, recommend_traffic: 0, marketplace_traffic: 0, affiliate_traffic: 0, live_traffic: 0, ads_traffic: 0, external_traffic: 0, organic_traffic: 0, trend: 'stable' }; }
}"""

c = c.replace(old_traf, new_traf)

# Update calls in collectAllData
c = c.replace('collectAds(shopCipher),', 'collectAds(shopCipher, days || 7),')

with open(r'f:\tiktok-crm-dev\server\src\services\growth-center\collector.ts', 'w', encoding='utf-8') as f:
    f.write(c)
print('Patched collector.ts')