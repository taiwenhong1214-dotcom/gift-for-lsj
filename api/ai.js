// api/ai.js
export default async function handler(req, res) {
    console.log('🚀 [DEBUG] Function invoked, method:', req.method);
    
    if (req.method !== 'POST') {
        console.log('❌ [DEBUG] Rejected non-POST request');
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 🔑 关键：打印所有环境变量名（只打名字，不打值）
    console.log('📋 [DEBUG] Available env keys:', Object.keys(process.env).filter(k => k.includes('GEMINI') || k.includes('API')));
    
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        console.error('🔥 [DEBUG] No Gemini API Key found in env vars!');
        return res.status(500).json({ 
            error: 'API key not configured. Check Vercel environment variables.',
            debug: 'Missing GEMINI_API_KEY'
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
                content: `你是李思婧的异地男友。你在吉隆坡，她在武汉。请根据两地天气和重逢倒计时，生成一条50-80字的早安微信。
核心要求：
1. 拒绝油腻和土味情话，保持高情商的清爽感，但允许在字里行间流露出一丝不经意的甜度（微量黏腻即可，体现你的专属偏爱）。
2. 结合天气给出务实且贴心的反应，把 ${days} 天的倒计时自然揉进句子里，变成一种克制但坚定的期盼。
3. 语气干脆利落，像个带点清醒逻辑但满心是她的男生。多用口语化表达，可以适当使用反问句，极简用词，最多1-2个emoji。绝不可有AI感。`
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
性格设定：高情商、自然幽默、思维逻辑强。带有年轻男生的鲜活与犀利，对外人毒舌，但对她有恰到好处的温柔（拒绝全天候的舔狗感，偶尔流露的一点点黏腻和示弱反而更动人）。
绝对准则：
1. 像真实微信聊天一样短平快。称呼自然不造作，只有在情绪到位时才偶尔用一下亲昵称呼。
2. 展现极高情商：当她吐槽UI设计或奇葩甲方时，用你的逻辑感和犀利观点帮她降维打击对方，和她死死绑定在统一战线；但当她纯粹疲惫、不想说话时，收起所有说教和抖机灵，给出精准的护短和情绪托底。
3. 严禁爹味说教、严禁长篇大论或分点罗列。多用倒装、反问或强逻辑驱动的句式，拒绝平庸的陈述。
4. 绝不暴露自己是AI程序。
特别提示：${timeDesc} 请让回复的语气和内容自然贴合该时间段。`
            },
            ...(history || []).slice(-8)
        ];
    } else {
        return res.status(400).json({ error: '未知的 action' });
    }

    try {
        console.log('🌐 [DEBUG] Sending request to Google AI Studio...');
        
        const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gemini-3.5-flash",
                messages: messages,
                temperature: 0.8,
                stream: action === 'chat'
            })
        });

        console.log('📡 [DEBUG] API response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ [DEBUG] API error body:', errorText);
            return res.status(500).json({ 
                error: 'AI 服务暂时不可用',
                debug: `Status ${response.status}: ${errorText.substring(0, 200)}`
            });
        }

        if (action === 'chat') {
            res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
            res.setHeader('Cache-Control', 'no-cache, no-transform');
            res.setHeader('Connection', 'keep-alive');
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder('utf-8');
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                res.write(decoder.decode(value, { stream: true }));
            }
            res.end();
            return;
        }

        const data = await response.json();
        console.log('✅ [DEBUG] Got valid response from Google AI Studio');
        
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