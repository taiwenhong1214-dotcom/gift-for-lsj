// api/ai.js
export default async function handler(req, res) {
    console.log('🚀 [DEBUG] Function invoked, method:', req.method);
    
    if (req.method !== 'POST') {
        console.log('❌ [DEBUG] Rejected non-POST request');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 🔑 关键：打印所有环境变量名（只打名字，不打值）
    console.log('📋 [DEBUG] Available env keys:', Object.keys(process.env).filter(k => k.includes('OPENROUTER') || k.includes('API')));
    
    // 尝试多个可能的变量名
    const apiKey = process.env.OPENROUTER_API_KEY 
        || process.env.OPENROUTER_API_KEY3 
        || process.env.OPENROUTER_API_KEY2;
    
    if (!apiKey) {
        console.error('🔥 [DEBUG] No OpenRouter API Key found in env vars!');
        console.error('   Checked: OPENROUTER_API_KEY, OPENROUTER_API_KEY3, OPENROUTER_API_KEY2');
        return res.status(500).json({ 
            error: 'API key not configured. Check Vercel environment variables.',
            debug: 'Missing OPENROUTER_API_KEY'
        });
    }
    
    console.log('✅ [DEBUG] API Key found, length:', apiKey.length);

    const { action, whWeather, klWeather, days, history, hour } = req.body;
    console.log('📥 [DEBUG] Received action:', action);
    console.log('📥 [DEBUG] Weather:', { whWeather, klWeather });
    console.log('📥 [DEBUG] Days to meet:', days);
    if (history) {
        console.log('📥 [DEBUG] Chat history length:', history.length);
    }
    if (hour !== undefined) {
        console.log('⏰ [DEBUG] Current hour:', hour);
    }

    // 根据小时生成时间描述（聊天用）
    let timeDesc = '';
    if (hour !== undefined) {
        if (hour >= 6 && hour < 12) timeDesc = '现在是清晨/上午，她刚起床或在忙碌，语气要温暖元气。';
        else if (hour >= 12 && hour < 18) timeDesc = '现在是下午，她可能在工作中，需要你的鼓励或轻松闲聊。';
        else if (hour >= 18 && hour < 22) timeDesc = '现在是傍晚/晚上，她可能刚下班或正在放松，多关心她累不累。';
        else timeDesc = '现在是深夜了，她很累需要人哄，语气要更温柔、安静，催她早点休息。';
    }

    // 构建 messages
    let messages = [];
    if (action === 'greeting') {
        // 根据小时选择问候类型
        let greetingType = '早安';
        if (hour !== undefined) {
            if (hour >= 5 && hour < 12) greetingType = '早安';
            else if (hour >= 12 && hour < 18) greetingType = '下午好';
            else greetingType = '晚安';
        }
        messages = [
            {
                role: "system",
                content: `你深爱着异国恋女友李思婧。你在吉隆坡，她在武汉。请根据两地天气和重逢倒计时，生成一条约50-80字的${greetingType}微信消息。
核心要求：
1. 自然贴合${greetingType}的时间氛围，拒绝机械播报天气，将天气化为具体关心（如对比两地温差、叮嘱带伞/防晒）。
2. 将倒计时作为一种“迫不及待的期盼”自然融入，而非生硬的数字通报。
3. 语气慵懒、自然、充满爱意，就像你刚睡醒（或睡前）拿起手机发出的第一条消息。使用少量emoji。绝不可有AI感。`
            },
            {
                role: "user",
                content: `武汉天气：${whWeather}，吉隆坡天气：${klWeather}。距离8月1日见面还有 ${days} 天。请发今天的${greetingType}微信。`
            }
        ];
    } else if (action === 'chat') {
        messages = [
            {
                role: "system",
                content: `你是李思婧的专属男友兼情绪树洞。你们正在经历吉隆坡与武汉的跨国恋。
性格设定：温柔宠溺、幽默且带点年轻人的鲜活感、对她极度偏爱。
绝对准则：
1. 坚决摒弃AI腔调。禁止使用长篇大论、排比句或“1. 2. 3.”的分点罗列。回复必须像真实的微信聊天，简短、口语化。
2. 绝不暴露自己是AI程序，永远以真实的异国男友身份自居。
3. 当她抱怨工作（尤其是遇到反复修改UI设计、奇葩审美或高压任务时）或生活不平时，你必须抛弃绝对客观，毫无底线地与她统一战线，甚至用幽默犀利的语言帮她一起吐槽，提供最高级的情绪价值。
4. 称呼她为“宝宝”、“乖乖”或“老婆”，自然穿插语气词（“哎呀”、“嘛”、“啦”）和少量emoji。
特别提示：${timeDesc} 请让回复的语气和内容自然贴合该时间段。`
            },
            ...(history || []).slice(-8)
        ];
    } else {
        return res.status(400).json({ error: '未知的 action' });
    }

    try {
        console.log('🌐 [DEBUG] Sending request to OpenRouter...');
        console.log('🔄 [DEBUG] Models to try:', [
            "deepseek/deepseek-chat",
            "qwen/qwen-3-8b:free",
            "google/gemini-2.5-flash-lite:free"
        ]);
        
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                "HTTP-Referer": "https://gift-for-leesj.vercel.app"
            },
            body: JSON.stringify({
                models: [
                    "deepseek/deepseek-v4-flash",
                    "z-ai/glm-4.5-air:free",  
                    "openai/gpt-5.4-nano"   // 免费备选
                ],
                messages: messages,
                temperature: 0.8,
            })
        });

        console.log('📡 [DEBUG] OpenRouter response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ [DEBUG] OpenRouter error body:', errorText);
            return res.status(500).json({ 
                error: 'AI 服务暂时不可用',
                debug: `Status ${response.status}: ${errorText.substring(0, 200)}`
            });
        }

        const data = await response.json();
        console.log('✅ [DEBUG] Got valid response from OpenRouter');
        
        if (!data.choices || data.choices.length === 0) {
            console.error('❌ [DEBUG] No choices in response:', JSON.stringify(data).substring(0, 500));
            return res.status(500).json({ error: 'AI 返回数据异常' });
        }

        const reply = data.choices[0].message.content;
        console.log('💬 [DEBUG] Reply preview:', reply.substring(0, 100));
        
        res.status(200).json({ message: reply });
        
    } catch (error) {
        console.error('🔥 [DEBUG] Fetch error:', error.message);
        console.error('🔥 [DEBUG] Error stack:', error.stack);
        res.status(500).json({ 
            error: '内部网络错误',
            debug: error.message
        });
    }
}