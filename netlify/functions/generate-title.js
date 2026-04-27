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

  const { playerName, aiName, playerStats, aiStats, world, history, alignCount, divergeCount, language, apiKey } = body;
  const key = process.env.GEMINI_API_KEY || apiKey;
  if (!key) {
    return { statusCode: 401, body: JSON.stringify({ error: "缺少 API Key" }) };
  }

  const worldNames = { fantasy: "奇幻", modern: "現代", scifi: "科幻" };
  const playerStatsText = Object.entries(playerStats).map(([k,v]) => `${k}:${v}`).join(' ');
  const aiStatsText = Object.entries(aiStats).map(([k,v]) => `${k}:${v}`).join(' ');

  const historyText = history.map((h, i) =>
    `第${i+1}幕：${playerName}選${h.player}，${aiName}選${h.ai}（一致：${h.player === h.ai ? "是" : "否"}）`
  ).join("\n");

  const prompt = `你是一個文字冒險遊戲的結局分析引擎。請用「${language}」語言生成稱號和評語。

【世界觀】${worldNames[world] || world}
【玩家】${playerName}（${playerStatsText}）
【AI夥伴】${aiName}（${aiStatsText}）
【選擇歷程】
${historyText}
【統計】一致 ${alignCount} 次，分歧 ${divergeCount} 次

請分析這段冒險的互動模式，為雙方各生成一個稱號和一段評語（30-50字）。
稱號要有詩意，評語要具體反映這局的選擇特色，不要只說一致幾次。

回傳純 JSON：
{
  "player": { "title": "稱號", "desc": "評語" },
  "ai": { "title": "稱號", "desc": "評語" }
}

只回傳 JSON，不要其他說明。`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.9, maxOutputTokens: 400 }
      })
    });

    const data = await res.json();
    if (data.error) {
      return { statusCode: 500, body: JSON.stringify({ error: data.error.message || JSON.stringify(data.error) }) };
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { statusCode: 500, body: JSON.stringify({ error: "無法解析稱號 JSON: " + text.slice(0, 200) }) };
    }

    const result = JSON.parse(jsonMatch[0]);
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result)
    };
  } catch (e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
