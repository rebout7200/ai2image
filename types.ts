export interface UserSummaryData {
  user_summary: {
    topic_count: number;
    post_count: number;
    likes_received: number;
    likes_given: number;
    days_visited: number;
    time_read: number;
    top_categories: {
      name: string;
      post_count: number;
    }[];
  };
  topics: {
    title: string;
    like_count: number;
    posts_count: number;
  }[];
  badges: any[];
}

export interface UserAction {
  action_type: number;
  created_at: string;
  excerpt: string;
  title: string;
  target_username?: string;
}

export interface UserActionsData {
  user_actions: UserAction[];
}

export interface CombinedData {
    username: string;
    summaryData: UserSummaryData;
    actionsData: UserAction[];
}


export interface AnalysisData {
  confidenceScore: number;
  dataCompletenessScore: number;
  basicInfo: {
    gender: string;
    age: string;
    birthday: string;
  };
  professionalProfile: {
    occupation: string;
    technicalLevel: string;
    experience: string;
    industry: string;
  };
  economicStatus: {
    incomeLevel: string;
    spendingHabits: string;
  };
  familyBackground: {
    maritalStatus: string;
    hasChildren: string;
    familyRole: string;
  };
  education: {
    degree: string;
    major: string;
    learningAbility: string;
  };
  personality: {
    mbti: string;
    socialStyle: string;
    values: string;
    hobbies: string;
  };
  lifestyle: {
    location: string;
    lifePace: string;
    lifeState: string;
  };
  digitalBehavior: {
    devicePreference: string;
    softwareHabits: string;
    infoSources: string;
  };
  uniqueTraits: {
    specialSkills: string;
    uniqueExperiences: string;
    personalBrand: string;
  };
  summary: string; // Markdown content
}

export const initialAnalysisData: AnalysisData = {
    confidenceScore: 0,
    dataCompletenessScore: 0,
    basicInfo: { gender: '', age: '', birthday: '' },
    professionalProfile: { occupation: '', technicalLevel: '', experience: '', industry: '' },
    economicStatus: { incomeLevel: '', spendingHabits: '' },
    familyBackground: { maritalStatus: '', hasChildren: '', familyRole: '' },
    education: { degree: '', major: '', learningAbility: '' },
    personality: { mbti: '', socialStyle: '', values: '', hobbies: '' },
    lifestyle: { location: '', lifePace: '', lifeState: '' },
    digitalBehavior: { devicePreference: '', softwareHabits: '', infoSources: '' },
    uniqueTraits: { specialSkills: '', uniqueExperiences: '', personalBrand: '' },
    summary: '',
};


export enum AppStatus {
  Idle = 'idle',
  ReadyForUpload = 'ready_for_upload',
  AwaitingUsername = 'awaiting_username',
  Analyzing = 'analyzing',
  Done = 'done',
  Error = 'error',
}