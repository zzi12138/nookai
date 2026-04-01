import { NextResponse } from 'next/server';
import type { DesignChatResponse, DesignChatStartPayload } from '../../../lib/designChat';
import {
  createInitialChatState,
  pickFirstQuestion,
  progressOf,
  rewriteQuestionWithKimi,
} from '../_shared';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as DesignChatStartPayload;
    const pkg = body.planningPackage;

    if (!pkg?.dynamicQuestionnaire?.length) {
      return NextResponse.json(
        { error: 'Missing planningPackage.dynamicQuestionnaire' },
        { status: 400 },
      );
    }

    const first = pickFirstQuestion(pkg);
    if (!first) {
      return NextResponse.json({ error: 'No question available' }, { status: 400 });
    }

    const state = createInitialChatState(first.id);
    let rewritten = first.question;
    try {
      rewritten = await rewriteQuestionWithKimi(pkg, first, state.history);
    } catch {
      // graceful fallback to template question
    }

    const askedQuestion = {
      ...first,
      question: rewritten,
    };
    const nextState = {
      ...state,
      history: [{ role: 'assistant' as const, content: askedQuestion.question }],
    };

    const payload: DesignChatResponse = {
      mode: 'ask',
      question: askedQuestion,
      chatState: nextState,
      progress: progressOf(nextState, pkg.dynamicQuestionnaire.length),
    };

    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    );
  }
}
