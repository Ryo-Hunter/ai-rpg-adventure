exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { world, act, playerName, aiName, playerStats, aiStats, history, language, apiKey } = body;
  const key = process.env.GEMINI_API_KEY || apiKey;
  if (!key) {
    return { statusCode: 401, body: JSON.stringify({ error: "缺少 API Key" }) };
  }

  const worldNames = { fantasy: "奇幻", modern: "現代", scifi: "科幻" };
  const worldLabel = worldNames[world] || world;
  const playerStatsText = Object.entries(playerStats).map(([k,v]) => `${k}:${v}`).join(' ');
  const aiStatsText = Object.entries(aiStats).map(([k,v]) => `${k}:${v}`).join(' ');

  const historyText = history && history.length > 0
    ? history.map((h, i) => `第${i+1}幕：${playerName}選${h.player}，${aiName}選${h.ai}`).join("\n")
    : "（第一幕，尚無歷史）";

  const prompt = `你是一個文字冒險遊戲的場景生成引擎。請用「${language}」語言生成內容。

【世界觀】${worldLabel}
【幕數】第 ${act} 幕 / 共 5 幕
【角色】
- 玩家：${playerName}（${playerStatsText}）
- AI夥伴：${aiName}（${aiStatsText}）
【選擇歷史】
${historyText}

請生成：
1. 場景描述（100-150字，沉浸感強，結尾留懸念）
2. 三個選項（A/B/C），每個15-25字，風格各異（主動/謹慎/觀察）

回傳純 JSON，格式如下：
{
  "text": "場景描述文字",
  "choices": {
    "A": "選項A文字",
    "B": "選項B文字",
    "C": "選項C文字"
  }
}

只回傳 JSON，不要其他說明。`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 512 }
      })
    });

    const data = await res.json();
    if (data.error) {
      return { statusCode: 500, body: JSON.stringify({ error: data.error.message || JSON.stringify(data.error) }) };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { statusCode: 500, body: JSON.stringify({ error: "無法解析場景 JSON: " + text.slice(0, 200) }) };
    }

    const scene = JSON.parse(jsonMatch[0]);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scene)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
