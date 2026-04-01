import { NextResponse } from 'next/server';
import type { DesignChatNextPayload, DesignChatResponse } from '../../../lib/designChat';
import {
  appendUserAnswerToHistory,
  mergeSlotUpdates,
  pickNextQuestion,
  progressOf,
  rewriteQuestionWithKimi,
  shouldFinalize,
  summarizeCollectedInfo,
} from '../_shared';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DesignChatNextPayload;
    const pkg = body.planningPackage;
    const state = body.chatState;
    const answer = body.answer;

    if (!pkg?.dynamicQuestionnaire?.length || !state) {
      return NextResponse.json(
        { error: 'Missing planningPackage or chatState' },
        { status: 400 },
      );
    }

    if (!answer || (Array.isArray(answer) && answer.length === 0)) {
      return NextResponse.json({ error: 'Missing answer' }, { status: 400 });
    }

    const currentQuestionId = state.askedQuestionIds[state.askedQuestionIds.length - 1];
    const currentQuestion = pkg.dynamicQuestionnaire.find((q) => q.id === currentQuestionId);
    if (!currentQuestion) {
      return NextResponse.json({ error: 'Current question not found in package' }, { status: 400 });
    }

    const historyWithUser = appendUserAnswerToHistory(state.history, currentQuestion, answer);
    const nextSlots = mergeSlotUpdates(state.slots, currentQuestion, answer);
    const updatedState = {
      ...state,
      history: historyWithUser,
      slots: nextSlots,
      rounds: state.rounds + 1,
    };

    const totalQuestions = pkg.dynamicQuestionnaire.length;
    const gate = shouldFinalize(updatedState, totalQuestions);
    if (gate.done) {
      const payload: DesignChatResponse = {
        mode: 'final',
        chatState: updatedState,
        progress: progressOf(updatedState, totalQuestions),
        finalReason: gate.reason || 'enough_info',
        collectedSummary: summarizeCollectedInfo(updatedState),
      };
      return NextResponse.json(payload);
    }

    const nextTemplate = pickNextQuestion(pkg, updatedState.askedQuestionIds);
    if (!nextTemplate) {
      const payload: DesignChatResponse = {
        mode: 'final',
        chatState: updatedState,
        progress: progressOf(updatedState, totalQuestions),
        finalReason: 'question_exhausted',
        collectedSummary: summarizeCollectedInfo(updatedState),
      };
      return NextResponse.json(payload);
    }

    const askedQuestionIds = [...updatedState.askedQuestionIds, nextTemplate.id];
    let rewritten = nextTemplate.question;
    try {
      rewritten = await rewriteQuestionWithKimi(pkg, nextTemplate, updatedState.history);
    } catch {
      // graceful fallback to template question
    }

    const askedQuestion = {
      ...nextTemplate,
      question: rewritten,
    };
    const nextState = {
      ...updatedState,
      askedQuestionIds,
      history: [...updatedState.history, { role: 'assistant' as const, content: askedQuestion.question }],
    };

    const payload: DesignChatResponse = {
      mode: 'ask',
      question: askedQuestion,
      chatState: nextState,
      progress: progressOf(nextState, totalQuestions),
    };

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    );
  }
}
