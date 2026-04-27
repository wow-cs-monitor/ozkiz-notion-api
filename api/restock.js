export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { query } = req.body;
  const NOTION_KEY = process.env.NOTION_KEY;
  const DB_ID = '5d2ae3562c064494b6b1f0fc6469aa8a';

  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${NOTION_KEY}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        filter: {
          property: '제품명',
          rich_text: { contains: query }
        },
        page_size: 5
      })
    });

    const data = await response.json();
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

    res.status(200).json({ results });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
