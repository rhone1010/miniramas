import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'

// PPTX is a ZIP of XML files — no external presentation library needed
// We use jszip (already likely in deps, or: npm install jszip)

const W = 9144000   // slide width in EMUs  (widescreen 13.33in * 914400)
const H = 5143500   // slide height in EMUs (7.5in * 685800... using 16:9)

function emu(inches: number) { return Math.round(inches * 914400) }

function makeSlideXml(content: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree>
    <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
    <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/><a:chOff x="0" y="0"/><a:chExt cx="${W}" cy="${H}"/></a:xfrm></p:grpSpPr>
    ${content}
  </p:spTree></p:cSld>
</p:sld>`
}

function textBox(id: number, x: number, y: number, w: number, h: number, text: string, opts: {
  size?: number, bold?: boolean, color?: string, font?: string, bg?: string
} = {}): string {
  const sz   = (opts.size  || 14) * 100
  const bold = opts.bold ? '<a:b/>' : ''
  const clr  = opts.color || '000000'
  const font = opts.font  || 'Arial'
  const bg   = opts.bg    ? `<a:solidFill><a:srgbClr val="${opts.bg}"/></a:solidFill>` : '<a:noFill/>'
  // escape XML
  const safe = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
  // split on newlines
  const paras = safe.split('\n').slice(0, 30).map(line => `
    <a:p><a:r><a:rPr lang="en-US" sz="${sz}" dirty="0">${bold}<a:solidFill><a:srgbClr val="${clr}"/></a:solidFill><a:latin typeface="${font}"/></a:rPr><a:t>${line}</a:t></a:r></a:p>`).join('')

  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="${id}" name="t${id}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>${bg}</p:spPr>
    <p:txBody><a:bodyPr wrap="square" lIns="45720" rIns="45720" tIns="45720" bIns="45720"/><a:lstStyle/>${paras}</p:txBody>
  </p:sp>`
}

function imageBox(id: number, rId: string, x: number, y: number, w: number, h: number): string {
  return `<p:pic>
    <p:nvPicPr><p:cNvPr id="${id}" name="img${id}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>
    <p:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>
    <p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>
  </p:pic>`
}

function bgRect(id: number, color: string): string {
  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="${id}" name="bg${id}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr/></p:nvSpPr>
    <p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/></a:xfrm>
    <a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="${color}"/></a:solidFill></p:spPr>
    <p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody>
  </p:sp>`
}

export async function POST(req: NextRequest) {
  try {
    const body    = await req.json()
    const results = body.results as any[]
    const title   = body.title || 'Minirama Export'

    if (!results?.length) {
      return NextResponse.json({ error: 'No results' }, { status: 400 })
    }

    const zip       = new JSZip()
    const slideRels: string[] = []
    const slideFiles: { name: string; xml: string }[] = []
    let   slideCount = 0

    const addSlide = (xml: string, rels: string = '') => {
      slideCount++
      const n    = slideCount
      const name = `slide${n}`
      slideFiles.push({ name, xml })
      slideRels.push(rels)
    }

    // ── TITLE SLIDE ──────────────────────────────────────────
    addSlide(makeSlideXml(
      bgRect(1, '0B1128') +
      textBox(2, emu(0.5), emu(2.5), emu(12), emu(1.2), 'minirama', { size: 54, bold: true, color: '00C9C8' }) +
      textBox(3, emu(0.5), emu(3.8), emu(12), emu(0.6), title, { size: 20, color: 'FFFFFF' }) +
      textBox(4, emu(0.5), emu(6.5), emu(12), emu(0.4), new Date().toLocaleDateString(), { size: 12, color: '888888' })
    ))

    // ── ONE PAIR PER RESULT ───────────────────────────────────
    for (let ri = 0; ri < results.length; ri++) {
      const r  = results[ri]
      const p  = r.params_used || {}
      const ok = !r.fatal_error

      // Slide 1: Image + params
      const imgRId = r.image_b64 ? 'rId2' : ''
      const imgRel = r.image_b64
        ? `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/img_${ri + 1}.jpg"/>`
        : ''

      const paramText = [
        'Pipeline:     ' + (p._preset || '-'),
        'Landscaping:  ' + (p.landscaping || '-'),
        'Lighting:     ' + (p.preset || p.lighting_preset || p.lighting || '-'),
        'Color:        ' + (p.color || '-'),
        'Detail:       ' + (p.detail || '-'),
        'Brightness:   ' + (p.brightness ?? 'auto'),
        'Expand:       ' + (p.expand ? 'yes' : 'no'),
        'Env Style:    ' + (p.environment_style || '-'),
        'Background:   ' + (p.background_structure || '-'),
      ].join('\n')

      const diagText = (r.render_log || []).slice(0, 5)
        .map((l: any) => (l.ok ? 'OK  ' : 'FAIL  ') + l.msg).join('\n')

      const sysText = (r.system_log || []).slice(0, 8)
        .map((l: any) => '[' + (l.code || '--') + '] ' + l.stage + (l.err ? ': ' + l.err : '')).join('\n')

      let s1content = bgRect(1, 'F4F4F2')
      let idCtr = 2
      if (r.image_b64) {
        s1content += imageBox(idCtr++, imgRId, emu(0.3), emu(0.3), emu(6.2), emu(6.2))
      }
      s1content += textBox(idCtr++, emu(6.8), emu(0.3),  emu(6.2), emu(0.7),  r.name || 'untitled', { size: 22, bold: true, color: '1A1A18' })
      s1content += textBox(idCtr++, emu(6.8), emu(1.1),  emu(1.5), emu(0.35), ok ? 'STABLE' : 'FAILED', { size: 11, bold: true, color: 'FFFFFF', bg: ok ? '1E8C4A' : 'C0392B' })
      s1content += textBox(idCtr++, emu(6.8), emu(1.6),  emu(0.8), emu(0.28), 'PARAMS', { size: 9, bold: true, color: '888880' })
      s1content += textBox(idCtr++, emu(6.8), emu(1.95), emu(6.2), emu(2.5),  paramText, { size: 9, color: '1A1A18', font: 'Courier New' })
      if (diagText) {
        s1content += textBox(idCtr++, emu(6.8), emu(4.6), emu(0.8), emu(0.28), 'DIAGNOSTICS', { size: 9, bold: true, color: '888880' })
        s1content += textBox(idCtr++, emu(6.8), emu(4.9), emu(6.2), emu(0.8),  diagText, { size: 8, color: '444440', font: 'Courier New' })
      }
      if (sysText) {
        s1content += textBox(idCtr++, emu(6.8), emu(5.8), emu(0.8), emu(0.28), 'SYSTEM LOG', { size: 9, bold: true, color: '888880' })
        s1content += textBox(idCtr++, emu(6.8), emu(6.1), emu(6.2), emu(0.8),  sysText, { size: 7, color: '555555', font: 'Courier New' })
      }

      addSlide(makeSlideXml(s1content), imgRel)

      if (r.image_b64) {
        zip.file(`ppt/media/img_${ri + 1}.jpg`,
          r.image_b64.replace(/^data:image\/\w+;base64,/, ''),
          { base64: true })
      }

      // Slide 2: Prompts
      const modSummary = [p.preset||p.lighting_preset||p.lighting, p.landscaping, p.interior_lights?'interior-lights':null, p.color, p.detail
      ].filter(Boolean).join(' | ')

      const layers = [
        { label: '1  SYSTEM PROMPT',               color: 'FFD60A', text: r.prompt_used },
        { label: '2  ACTIVE MODIFIERS',             color: '00C9C8', text: modSummary },
        { label: '3  STRUCTURE BLOCK (verbatim)',   color: 'A78BFA', text: p.structureBlock },
        { label: '4  MANUAL PROMPT (appended)',     color: 'FB923C', text: r.manual_prompt_used },
        { label: '5  CUSTOM PROMPT (replaced all)', color: 'F87171', text: p.customPrompt },
      ].filter(l => l.text?.trim())

      let s2content = bgRect(1, '0B1128')
      s2content += textBox(2, emu(0.4), emu(0.15), emu(12.5), emu(0.45), (r.name || 'untitled') + ' — Prompts', { size: 14, bold: true, color: '00C9C8' })
      idCtr = 3
      let py = 0.72
      for (const layer of layers) {
        if (py > 6.5) break
        s2content += textBox(idCtr++, emu(0.4), emu(py), emu(12.5), emu(0.28), layer.label, { size: 9, bold: true, color: layer.color })
        py += 0.3
        const txt = layer.text.slice(0, 2000) + (layer.text.length > 2000 ? '...' : '')
        const lines = txt.split('\n').length
        const bh = Math.max(lines * 0.16, 0.2)
        s2content += textBox(idCtr++, emu(0.4), emu(py), emu(12.5), emu(bh), txt, { size: 7, color: 'CCCCCC', font: 'Courier New' })
        py += bh + 0.15
      }

      addSlide(makeSlideXml(s2content))
    }

    // ── BUILD ZIP ─────────────────────────────────────────────
    // Slide relationship template
    const baseRel = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  EXTRA
</Relationships>`

    for (let i = 0; i < slideFiles.length; i++) {
      const sf  = slideFiles[i]
      const rel = slideRels[i] || ''
      zip.file(`ppt/slides/${sf.name}.xml`, sf.xml)
      zip.file(`ppt/slides/_rels/${sf.name}.xml.rels`, baseRel.replace('EXTRA', rel))
    }

    // Presentation.xml
    const slideIdList = slideFiles.map((_, i) =>
      `<p:sldId id="${256 + i}" r:id="rId${i + 2}"/>`).join('\n    ')
    const presXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>
  <p:sldIdLst>${slideIdList}</p:sldIdLst>
  <p:sldSz cx="${W}" cy="${H}" type="screen16x9"/>
  <p:notesSz cx="6858000" cy="9144000"/>
</p:presentation>`
    zip.file('ppt/presentation.xml', presXml)

    // Presentation rels
    const presRels = slideFiles.map((sf, i) =>
      `<Relationship Id="rId${i + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/${sf.name}.xml"/>`
    ).join('\n  ')
    zip.file('ppt/_rels/presentation.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  ${presRels}
</Relationships>`)

    // Minimal slide master + layout
    const masterXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
  <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/><a:chOff x="0" y="0"/><a:chExt cx="${W}" cy="${H}"/></a:xfrm></p:grpSpPr>
  </p:spTree></p:cSld>
  <p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr lang="en-US"/></a:lvl1pPr></p:titleStyle>
  <p:bodyStyle><a:lvl1pPr><a:defRPr lang="en-US"/></a:lvl1pPr></p:bodyStyle>
  <p:otherStyle><a:lvl1pPr><a:defRPr lang="en-US"/></a:lvl1pPr></p:otherStyle></p:txStyles>
  <p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>
</p:sldMaster>`
    zip.file('ppt/slideMasters/slideMaster1.xml', masterXml)
    zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`)

    const layoutXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" type="blank">
  <p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
  <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${W}" cy="${H}"/><a:chOff x="0" y="0"/><a:chExt cx="${W}" cy="${H}"/></a:xfrm></p:grpSpPr>
  </p:spTree></p:cSld>
</p:sldLayout>`
    zip.file('ppt/slideLayouts/slideLayout1.xml', layoutXml)
    zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`)

    // [Content_Types].xml
    const imageTypes = results.some(r => r.image_b64)
      ? '<Default Extension="jpg" ContentType="image/jpeg"/>' : ''
    const slideOverrides = slideFiles.map((sf, i) =>
      `<Override PartName="/ppt/slides/${sf.name}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`
    ).join('\n  ')
    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${imageTypes}
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  ${slideOverrides}
</Types>`)

    // _rels/.rels
    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`)

    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
    const filename = title.replace(/\s+/g, '-') + '-' + Date.now() + '.pptx'

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type':        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': 'attachment; filename="' + filename + '"',
      }
    })

  } catch (err: any) {
    console.error('[export]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
