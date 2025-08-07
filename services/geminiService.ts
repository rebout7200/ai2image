import { GoogleGenAI, Type } from "@google/genai";
import type { UserSummaryData, UserAction } from '../types';

if (!process.env.API_KEY) {
  console.warn("API_KEY environment variable not set. AI analysis will fail.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

const responseSchema = {
  confidenceScore: { type: Type.NUMBER, description: 'AI对本次分析结果的自信程度，0-100分' },
  dataCompletenessScore: { type: Type.NUMBER, description: '根据输入数据量评估的数据完整度，0-100分' },
  basicInfo: {
    type: Type.OBJECT,
    properties: {
      gender: { type: Type.STRING, description: '性别推测' },
      age: { type: Type.STRING, description: '年龄推测' },
      birthday: { type: Type.STRING, description: '可能的生日或星座' },
    }
  },
  professionalProfile: {
    type: Type.OBJECT,
    properties: {
      occupation: { type: Type.STRING, description: '可能职业' },
      technicalLevel: { type: Type.STRING, description: '技术水平' },
      experience: { type: Type.STRING, description: '工作经验' },
      industry: { type: Type.STRING, description: '行业背景' },
    }
  },
  economicStatus: {
    type: Type.OBJECT,
    properties: {
      incomeLevel: { type: Type.STRING, description: '收入水平推测' },
      spendingHabits: { type: Type.STRING, description: '消费观念' },
    }
  },
  familyBackground: {
    type: Type.OBJECT,
    properties: {
      maritalStatus: { type: Type.STRING, description: '婚姻状况' },
      hasChildren: { type: Type.STRING, description: '是否有孩子' },
      familyRole: { type: Type.STRING, description: '家庭角色' },
    }
  },
  education: {
    type: Type.OBJECT,
    properties: {
      degree: { type: Type.STRING, description: '学历水平' },
      major: { type: Type.STRING, description: '专业背景' },
      learningAbility: { type: Type.STRING, description: '学习能力' },
    }
  },
  personality: {
    type: Type.OBJECT,
    properties: {
      mbti: { type: Type.STRING, description: 'MBTI性格类型' },
      socialStyle: { type: Type.STRING, description: '社交风格' },
      values: { type: Type.STRING, description: '价值观念' },
      hobbies: { type: Type.STRING, description: '兴趣爱好' },
    }
  },
  lifestyle: {
    type: Type.OBJECT,
    properties: {
      location: { type: Type.STRING, description: '居住地推测' },
      lifePace: { type: Type.STRING, description: '生活节奏' },
      lifeState: { type: Type.STRING, description: '生活状态' },
    }
  },
  digitalBehavior: {
    type: Type.OBJECT,
    properties: {
      devicePreference: { type: Type.STRING, description: '设备偏好' },
      softwareHabits: { type: Type.STRING, description: '软件使用习惯' },
      infoSources: { type: Type.STRING, description: '信息获取方式' },
    }
  },
  uniqueTraits: {
    type: Type.OBJECT,
    properties: {
      specialSkills: { type: Type.STRING, description: '特殊才能或技能' },
      uniqueExperiences: { type: Type.STRING, description: '独特经历或背景' },
      personalBrand: { type: Type.STRING, description: '个人品牌或影响力' },
    }
  },
  summary: { type: Type.STRING, description: '综合个人简介，使用Markdown格式。额外在包括该用户在论坛活跃的时间轴' },
};


const PROMPT_TEMPLATE = (analysisData: object, source: 'script' | 'csv') => {
    const scriptHint = `
**重要提示：** 用户活动数据（只包含发帖和回帖）中的字段非常关键，它区分了用户的不同行为：
*   \`action_type: 4\` 代表 **发布新主题**。这通常是用户主动发起讨论或分享的核心内容。
*   \`action_type: 5\` 代表 **回复帖子**。这显示了用户的互动习惯和交流方式。
    *   当 \`action_type\` 是 5 时，\`target_username\` 字段会显示被回复用户的用户名，这对于理解对话上下文至关重要。

请务必在分析时仔细区分这些行为。`;

    const csvHint = `
**数据来源提示**: 以下数据来自用户自行下载的帖子存档(CSV文件)。这份数据主要反映了用户的发帖和回帖内容。与脚本抓取的数据相比，它可能缺少一些上下文信息，例如明确的 \`action_type\` (新主题 vs 回复) 和 \`target_username\` (回复对象)。在分析时，请将重点放在用户的发言内容(\`excerpt\`)和他们参与讨论的主题(\`title\`)上，并基于此进行推理。`;

    return `
请基于以下用户的公开论坛活动数据，进行深入的用户画像分析。你的任务是扮演基于以下用户在论坛上的发帖互动回帖数据对用户进行画像，请总结用户的兴趣点、活跃时段、喜欢的主题和讨论风格，尝试预测用户喜爱的品牌和崇拜的人物（主要根据用户的发帖和参与话题的语境来判断是否是喜爱，不单单是提及或者参与就是喜爱，并对喜爱程度进行打分）。

**用户数据:**
\`\`\`json
${JSON.stringify(analysisData, null, 2)}
\`\`\`

${source === 'script' ? scriptHint : csvHint}

**分析与输出要求:**

1.  **深度推理分析**:
    *   对所有维度（基本信息、职业、经济、个性等）进行全面、深入的推测。
    *   注意：请确保总结是基于用户的行为和发言而不是个人假设，以保证客观性和准确性。
    *   请在回复的最后尽可能预测这个用户的性别和年龄区间，年龄区间误差控制在3年以内。
    *   包括对用户知识的总结提取（从用户的发言中有哪些可以吸收的知识点）、用户语言特征提取（可以拿着用户特征去模仿用户的发言）、用户习惯的提取和建议（可以引导用户更好的水论坛）。
    *   重点发掘用户的独特性格和与众不同的地方。
    *   需要是足够客观不掺杂任何感情的总结和分析。
    *   生成用户的活跃时间轴。

2.  **生成评分与简介**:
    *   给出\`confidenceScore\` (分析自信度, 0-100) 和 \`dataCompletenessScore\` (数据完整度, 0-100)。
    *   在 \`summary\` 字段中，撰写一份流畅、详细的个人简介 (使用Markdown)。
    *   **必须有理有据**：对于每个关键结论，必须明确引用**具体的数据依据**（如帖子标题、发言片段等），以增强分析的可信度。

3.  **严格格式化**:
    *   最终输出必须是**严格的单一JSON对象**，完全符合预设的Schema，不要在JSON之外添加任何注释或文字。
    *   输出内容需要为中文，注意格式整齐。
`;
};

export async function* generateProfileAnalysisStream(
  username: string,
  summaryData: UserSummaryData,
  actionsData: UserAction[],
  source: 'script' | 'csv' = 'script'
): AsyncGenerator<string, void, unknown> {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY is not configured. Please set the environment variable.");
  }

  const analysisPayload = {
    username: username,
    summary: {
      ...summaryData.user_summary,
      top_topics: summaryData.topics.slice(0, 10).map(t => t.title),
    },
    recent_actions: actionsData
  };
  
  const prompt = PROMPT_TEMPLATE(analysisPayload, source);

  const stream = await ai.models.generateContentStream({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: responseSchema
        }
    }
  });

  for await (const chunk of stream) {
    yield chunk.text;
  }
}