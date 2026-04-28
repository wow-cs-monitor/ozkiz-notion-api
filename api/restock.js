module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const raw = req.method === 'GET'
    ? (req.query.q || '')
    : (req.body && req.body.query) || '';

  const removeWords = [
    '입고일은', '입고일', '재입고', '언제예요', '언제요', '언제',
    '알려줘', '알려주세요', '확인', '문의', '어때요', '어때',
    '반팔', '긴팔', '티셔츠', '바지', '치마', '원피스',
    '자켓', '코트', '니트', '가디건', '조끼', '점퍼',
    '세트', '상하복', '상의', '하의', '후드', '집업'
  ];

  let cleaned = raw;
  removeWords.forEach(function(word) {
    cleaned = cleaned.split(word).join('');
  });
  cleaned = cleaned.replace(/[?？!！~]/g, '').trim();

  // "-" 이후 핵심 키워드 추출
  let keyword = cleaned.replace(/^[^-]*-\s*/, '').trim();
  if (keyword.length < 2) keyword = cleaned;

  const NOTION_KEY = process.env.NOTION_KEY;
  const DB_ID = '5d2ae3562c064494b6b1f0fc6469aa8a';

  async function searchNotion(searchKeyword) {
    const response = await fetch('https://api.notion.com/v1/databases/' + DB_ID + '/query', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + NOTION_KEY,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: { property: '제품명', rich_text: { contains: searchKeyword } },
        page_size: 5
      })
    });
    return response.json();
  }

  try {
    let data = await searchNotion(keyword);

    // 결과 없으면 cleaned 전체로 재검색
    if (!data.results || !data.results.length) {
      data = await searchNotion(cleaned);
    }

    // 그래도 없으면 원본으로 재검색
    if (!data.results || !data.results.length) {
      data = await searchNotion(raw.trim());
    }

    const results = (data.results || []).map(function(page) {
      const props = page.properties;
      return {
        제품명: (props['제품명'] && props['제품명'].title && props['제품명'].title[0] && props['제품명'].title[0].plain_text) || '',
        입고일: (props['입고일'] && props['입고일'].date && props['입고일'].date.start) || '미정',
        입고일변경: (props['입고일 변경'] && props['입고일 변경'].date && props['입고일 변경'].date.start) || '',
        진행상태: (props['진행상태'] && props['진행상태'].status && props['진행상태'].status.name) || (props['진행상태'] && props['진행상태'].select && props['진행상태'].select.name) || '',
        시즌: (props['시즌'] && props['시즌'].select && props['시즌'].select.name) || '',
        브랜드: (props['브랜드'] && props['브랜드'].select && props['브랜드'].select.name) || '',
        검품상태: (props['검품상태'] && props['검품상태'].select && props['검품상태'].select.name) || ''
      };
    });

    res.status(200).json({ results: results, keyword_used: keyword });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
