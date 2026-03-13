import { Suspense } from 'react';
import ResultClient from './ResultClient';

export const dynamic = 'force-dynamic';

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-stone-50 pb-20">
          <div className="max-w-md mx-auto px-4 pt-6">
            <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-center text-stone-500">
              正在加载效果图...
            </div>
          </div>
        </div>
      }
    >
      <ResultClient />
    </Suspense>
  );
}
