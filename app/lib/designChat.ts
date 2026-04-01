import type { DynamicQuestion, PlanningPackage } from '../api/plan/route';

export type ChatRole = 'assistant' | 'user';

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

export type ChatSlots = {
  usage: boolean;
  emotion: boolean;
  colorDepth: boolean;
  changeIntensity: boolean;
  focusArea: boolean;
  dislikeReplace: boolean;
};

export type DesignChatState = {
  askedQuestionIds: string[];
  history: ChatMessage[];
  slots: ChatSlots;
  rounds: number;
};

export type DesignChatQuestion = DynamicQuestion;

export type DesignChatAskResponse = {
  mode: 'ask';
  question: DesignChatQuestion;
  chatState: DesignChatState;
  progress: {
    asked: number;
    total: number;
    filledSlots: number;
  };
};

export type DesignChatFinalResponse = {
  mode: 'final';
  chatState: DesignChatState;
  progress: {
    asked: number;
    total: number;
    filledSlots: number;
  };
  finalReason: 'enough_info' | 'max_rounds' | 'question_exhausted';
  collectedSummary: string;
};

export type DesignChatResponse = DesignChatAskResponse | DesignChatFinalResponse;

export type DesignChatStartPayload = {
  planningPackage: PlanningPackage;
};

export type DesignChatNextPayload = {
  planningPackage: PlanningPackage;
  chatState: DesignChatState;
  answer: string | string[];
};

export const EMPTY_SLOTS: ChatSlots = {
  usage: false,
  emotion: false,
  colorDepth: false,
  changeIntensity: false,
  focusArea: false,
  dislikeReplace: false,
};

export function countFilledSlots(slots: ChatSlots) {
  return Object.values(slots).filter(Boolean).length;
}
