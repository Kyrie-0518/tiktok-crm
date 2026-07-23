"""Add META badge to growth center pages"""
import re

files = [
    r'f:\tiktok-crm-dev\client\src\pages\growth-center\ShopDiagnosis.tsx',
    r'f:\tiktok-crm-dev\client\src\pages\growth-center\DiagnosisHistory.tsx',
    r'f:\tiktok-crm-dev\client\src\pages\growth-center\AIReview.tsx',
    r'f:\tiktok-crm-dev\client\src\pages\growth-center\DataDebug.tsx',
]
badge = '<span style={{fontSize:10,color:"#2563eb",background:"#eff6ff",padding:"1px 6px",borderRadius:4,marginLeft:8,fontWeight:600}}>META</span>'

for fp in files:
    with open(fp, 'r', encoding='utf-8') as f:
        c = f.read()
    c = re.sub(r'(<h2[^>]*>)(.*?)(</h2>)', r'\1\2 ' + badge + r'\3', c, count=1)
    c = re.sub(r'(<Title[^>]*>)(.*?)(</Title>)', r'\1\2 ' + badge + r'\3', c, count=1)
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(c)
    print(f'Patched: {fp}')
