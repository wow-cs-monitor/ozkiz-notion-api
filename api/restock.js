export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const raw = req.method === 'GET'
    ? (req.query.q || '')
    : req.body?.query || '';

  // 불필요한 질문 표현 제거
  let cleaned = raw
    .replace(/입고일.*$/g, '')      // "입고일은?" 이후 제거
    .replace(/재입고.*$/g, '')      // "재입고" 이후 제거
    .replace(/언제.*$/g, '')        // "언제" 이후 제거
    .replace(/알려.*$/g, '')        // "알려줘" 이후 제거
    .replace(/확인.*$/g, '')        // "확인" 이후 제거
    .replace(/문의.*$/g, '')        // "문의" 이후 제거
    .replace(/[?？!！~]/g, '')      // 특수문자 제거
    .trim();

  // "-" 이후 핵심 키워드 추출
  let keyword = cleaned
    .replace(/^[^-–]*[-–]\s*/, '')
    .replace(/\s*(세트|상하복|상의|하의|원피스|자켓|팬츠|티셔츠|후드|집업)\s*/g, '')
    .trim();

  if (keyword.length < 2) keyword = cleaned.trim();

  const NOTION_KEY = process.env.NOTION_KEY;
  const DB_ID = '5d2ae3562c064494b6b1f0fc6469aa8a';

  try {
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

    // 2차: 결과 없으면 cleaned 전체로 재검색
    if (!data.results?.length && keyword !== cleaned.trim()) {
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
            rich_text: { contains: cleaned.trim() }
          },
          page_size: 5
        })
      });
      data = await response.json();
    }

    const results = data.results?.map(page => {
      const pr
