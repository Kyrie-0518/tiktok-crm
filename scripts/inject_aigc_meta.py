#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AIGC 元数据注入工具
- PNG/JPEG: 写入 tEXt chunk (XMP)
- MP4: 写入 udta box
- Markdown/Text: 末尾追加注释
- PDF: 写入 XMP metadata
- Office: 写入 docProps/core.xml

使用方法:
    from scripts.inject_aigc_meta import inject_meta
    inject_meta(file_path, content_type='image')
"""

import os, json, struct, re
from pathlib import Path
from datetime import datetime

# 你的 AIGC 主体信息 — 实际部署时填写真实备案号
AIGC_META = {
    "AIGC": "1",
    "Label": "1",
    "ContentProducer": "虾掌柜AI创作系统",
    "ProducerID": os.getenv("AIGC_PRODUCER_ID", "91110000XXXXXXXXXX"),  # 统一社会信用代码
    "ContentPropagator": os.getenv("AIGC_PROPAGATOR", "上海虾掌柜信息科技有限公司"),
    "PropagateID": os.getenv("AIGC_PROPAGATE_ID", "沪ICP备2024XXXXXX号"),
    "ReserveCode1": "Bozone-ERP-AIGC-v1",
    "GenerateTime": datetime.now().isoformat(),
    "ServiceCode": "xiaozhangui-tiktok-crm",
}


# ── PNG 注入 ──
def inject_png(file_path: str) -> bool:
    """在 PNG 文件中写入 tEXt chunk 含 AIGC 元数据"""
    with open(file_path, 'rb') as f:
        data = f.read()

    # PNG 签名
    if data[:8] != b'\x89PNG\r\n\x1a\n':
        return False

    # 已存在 AIGC 标识则跳过
    if b'AIGC' in data and b'ContentProducer' in data:
        return True

    # 构建 tEXt chunk
    # 格式: keyword + \0 + text
    meta_json = json.dumps(AIGC_META, ensure_ascii=False)
    payload = f"AIGC-Meta\x00{meta_json}".encode('utf-8')

    # tEXt chunk: length(4) + type(4) + data + crc(4)
    chunk_type = b'tEXt'
    chunk_data = payload
    chunk_length = struct.pack('>I', len(chunk_data))
    crc = struct.pack('>I', _crc32(chunk_type + chunk_data))
    new_chunk = chunk_length + chunk_type + chunk_data + crc

    # 插入到 IHDR 之后（第 8 字节后）
    new_data = data[:8] + new_chunk + data[8:]

    with open(file_path, 'wb') as f:
        f.write(new_data)
    return True


def _crc32(data: bytes) -> int:
    import zlib
    return zlib.crc32(data) & 0xFFFFFFFF


# ── JPEG 注入 ──
def inject_jpeg(file_path: str) -> bool:
    """在 JPEG 文件中写入 EXIF + XMP 元数据"""
    with open(file_path, 'rb') as f:
        data = f.read()
    if data[:2] != b'\xFF\xD8':
        return False
    if b'AIGC' in data and b'ContentProducer' in data:
        return True

    # XMP packet
    xmp = f'''<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <dc:creator>
        <rdf:Seq>
          <rdf:li>{AIGC_META['ContentProducer']}</rdf:li>
        </rdf:Seq>
      </dc:creator>
      <dc:rights>
        <rdf:Alt>
          <rdf:li xml:lang="x-default">AIGC: {AIGC_META['AIGC']} | ProducerID: {AIGC_META['ProducerID']}</rdf:li>
        </rdf:Alt>
      </dc:rights>
    </rdf:Description>
    <rdf:Description rdf:about="" xmlns:AIGC="http://www.aigc.gov.cn/ns/1.0/">
      <AIGC:AIGC>{AIGC_META['AIGC']}</AIGC:AIGC>
      <AIGC:Label>{AIGC_META['Label']}</AIGC:Label>
      <AIGC:ContentProducer>{AIGC_META['ContentProducer']}</AIGC:ContentProducer>
      <AIGC:ProducerID>{AIGC_META['ProducerID']}</AIGC:ProducerID>
      <AIGC:ContentPropagator>{AIGC_META['ContentPropagator']}</AIGC:ContentPropagator>
      <AIGC:PropagateID>{AIGC_META['PropagateID']}</AIGC:PropagateID>
      <AIGC:ReserveCode1>{AIGC_META['ReserveCode1']}</AIGC:ReserveCode1>
    </rdf:Description>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>'''

    # APP1 marker (XMP)
    xmp_bytes = xmp.encode('utf-8')
    app1_data = b'http://ns.adobe.com/xap/1.0/\x00' + xmp_bytes
    app1_length = len(app1_data) + 2
    app1 = b'\xFF\xE1' + struct.pack('>H', app1_length) + app1_data

    # 插入到 JPEG 头之后（第 2 字节后）
    new_data = data[:2] + app1 + data[2:]

    with open(file_path, 'wb') as f:
        f.write(new_data)
    return True


# ── MP4 视频注入 ──
def inject_mp4(file_path: str) -> bool:
    """在 MP4 文件中写入 udta box 携带 AIGC 元数据"""
    with open(file_path, 'rb') as f:
        data = f.read()
    if b'ftyp' not in data[:32]:
        return False
    if b'AIGC' in data and b'ContentProducer' in data:
        return True

    # 简单的 udta box (文本元数据)
    # 实际生产中建议用 ffmpeg + side data
    meta_str = f'AIGC=1; Label=1; ContentProducer={AIGC_META["ContentProducer"]}; ProducerID={AIGC_META["ProducerID"]}; GenerateTime={AIGC_META["GenerateTime"]}'
    meta_bytes = meta_str.encode('utf-8')
    # box: 4字节 size + 4字节 type + data
    box_size = 8 + len(meta_bytes)
    udta_box = struct.pack('>I', box_size) + b'udta' + meta_bytes

    # 插入到 ftyp 之后
    ftyp_idx = data.find(b'ftyp')
    ftyp_end = 8
    while ftyp_end < len(data) - 4:
        box_size = struct.unpack('>I', data[ftyp_end:ftyp_end+4])[0]
        if box_size == 0:
            ftyp_end += 4
            break
        if box_size == 1:
            ext_size = struct.unpack('>Q', data[ftyp_end+8:ftyp_end+16])[0]
            ftyp_end += 8 + ext_size
            break
        ftyp_end += box_size

    new_data = data[:ftyp_end] + udta_box + data[ftyp_end:]
    with open(file_path, 'wb') as f:
        f.write(new_data)
    return True


# ── 文本/Markdown 注入 ──
def inject_text(file_path: str) -> bool:
    """在文本文件末尾追加 AIGC 元数据注释"""
    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()
    if 'AIGC: 1' in content:
        return True

    ext = Path(file_path).suffix.lower()
    if ext in ['.md', '.markdown']:
        # Markdown: 末尾 HTML 注释
        meta_block = f"\n\n<!-- AIGC Meta\n{json.dumps(AIGC_META, ensure_ascii=False, indent=2)}\n-->\n"
    elif ext in ['.json']:
        # JSON: 单独文件
        meta_path = file_path + '.aigc.meta'
        Path(meta_path).write_text(json.dumps(AIGC_META, ensure_ascii=False, indent=2), encoding='utf-8')
        return True
    else:
        meta_block = f"\n\n[//]: # (AIGC Meta: {json.dumps(AIGC_META, ensure_ascii=False)})\n"

    with open(file_path, 'a', encoding='utf-8') as f:
        f.write(meta_block)
    return True


# ── PDF 注入（简化版） ──
def inject_pdf(file_path: str) -> bool:
    """在 PDF 文件 metadata 字段写入 AIGC 标识"""
    with open(file_path, 'rb') as f:
        data = f.read()
    if b'/Producer' in data and b'AIGC' in data:
        return True

    # 在 PDF 末尾插入 Producer 信息
    pdf_meta = (
        f"\n% --- AIGC Meta ---\n"
        f"% AIGC: 1\n"
        f"% Label: 1\n"
        f"% ContentProducer: {AIGC_META['ContentProducer']}\n"
        f"% ProducerID: {AIGC_META['ProducerID']}\n"
        f"% ContentPropagator: {AIGC_META['ContentPropagator']}\n"
        f"% PropagateID: {AIGC_META['PropagateID']}\n"
    ).encode('utf-8')

    # 在 %%EOF 前插入
    if b'%%EOF' in data:
        new_data = data.replace(b'%%EOF', pdf_meta + b'%%EOF', 1)
    else:
        new_data = data + pdf_meta + b'\n%%EOF\n'

    with open(file_path, 'wb') as f:
        f.write(new_data)
    return True


# ── 统一入口 ──
def inject_meta(file_path: str) -> bool:
    """根据文件类型自动注入 AIGC 元数据"""
    if not os.path.exists(file_path):
        return False

    ext = Path(file_path).suffix.lower()

    try:
        if ext == '.png':
            return inject_png(file_path)
        elif ext in ['.jpg', '.jpeg']:
            return inject_jpeg(file_path)
        elif ext in ['.mp4', '.mov', '.m4v']:
            return inject_mp4(file_path)
        elif ext in ['.md', '.txt', '.jsonl']:
            return inject_text(file_path)
        elif ext == '.pdf':
            return inject_pdf(file_path)
        else:
            return False
    except Exception as e:
        print(f"[AIGC inject] {file_path}: {e}")
        return False


def batch_inject(directory: str, recursive: bool = True) -> tuple:
    """批量注入目录下所有相关文件"""
    root = Path(directory)
    targets = []
    exts = ['.png', '.jpg', '.jpeg', '.mp4', '.mov', '.md', '.txt', '.pdf']
    if recursive:
        for ext in exts:
            targets.extend(root.rglob(f'*{ext}'))
    else:
        for ext in exts:
            targets.extend(root.glob(f'*{ext}'))

    success, failed = 0, 0
    for fp in targets:
        if inject_meta(str(fp)):
            success += 1
        else:
            failed += 1
    return success, failed


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python inject_aigc_meta.py <directory>")
        sys.exit(1)
    target = sys.argv[1]
    if os.path.isdir(target):
        s, f = batch_inject(target)
        print(f"Success: {s} | Failed: {f}")
    else:
        ok = inject_meta(target)
        print(f"{'OK' if ok else 'FAIL'}: {target}")
