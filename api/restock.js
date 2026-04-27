export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const raw = req.method === 'GET'
    ? (req.query.q || '')
    : req.body?.query || '';

  // "-" 이후 핵심 키워드 추출
  let keyword = raw
    .replace(/^[^-–]*[-–]\s*/, '')   // "-" 앞 모든 문자 제거 (글자수 무관)
    .replace(/\s*(세트|상하복|상의|하의|원피스|자켓|팬츠|티셔츠|후드|집업)\s*/g, '')
    .trim();

  // 키워드가 너무 짧거나 "-"가 없으면 원본 사용
  if (keyword.length < 2) keyword = raw.trim();

  const NOTION_KEY = process.env.NOTION_KEY;
  const DB_ID = '5d2ae3562c064494b6b1f0fc6469aa8a';

  try {
    // 1차: 핵심 키워드로 검색
    let response = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: '제품명',
          rich_text: { contains: keyword }
        },
        page_size: 5
      })
    });

    let data = await response.json();

    // 2차: 결과 없으면 원본으로 재검색
    if (!data.results?.length && keyword !== raw.trim()) {
      response = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${NOTION_KEY}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            property: '제품명',
            rich_text: { contains: raw.trim() }
          },
          page_size: 5
        })
      });
      data = await response.json();
    }

    const results = data.results?.map(page => {
      const props = page.properties;
      return {
        제품명: props['제품명']?.title?.[0]?.plain_text || '',
        입고일: props['입고일']?.date?.start || '미정',
        입고일변경: props['입고일 변경']?.date?.start || '',
        진행상태: props['진행상태']?.status?.name || props['진행상태']?.select?.name || '',
        시즌: props['시즌']?.select?.name || '',
        브랜드: props['브랜드']?.select?.name || '',
        검품상태: props['검품상태']?.select?.name || ''
      };
    });

    res.status(200).json({ results, keyword_used: keyword });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
