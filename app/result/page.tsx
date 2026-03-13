'use client';

export const dynamic = 'force-dynamic';

import { useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Cat, X } from 'lucide-react';

const spring = { type: 'spring', stiffness: 260, damping: 22 } as const;

const products = [
  {
    id: 'sofa',
    name: '猫咪定制版懒人沙发',
    price: '¥399',
    position: 'top-1/3 left-1/4',
    description: '柔软亲肤，窝在上面像抱着一团云。',
  },
  {
    id: 'lamp',
    name: '暖阳奶油氛围灯',
    price: '¥219',
    position: 'top-2/3 left-2/3',
    description: '暖光包裹角落，让房间更有温度。',
  },
];

export default function ResultPage() {
  const searchParams = useSearchParams();
  const img = searchParams.get('img');
  const imageUrl = useMemo(() => (img ? decodeURIComponent(img) : ''), [img]);
  const [active, setActive] = useState<typeof products[number] | null>(null);

  return (
    <div className="min-h-screen bg-stone-50 pb-20">
      <div className="max-w-md mx-auto px-4 pt-6">
        <header className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-stone-500">NookAI 效果图</p>
            <h1 className="text-xl font-semibold text-stone-800">猫咪包工头已完工</h1>
          </div>
          <Cat className="text-orange-500" size={30} />
        </header>

        {imageUrl ? (
          <div className="relative rounded-2xl overflow-hidden shadow-lg">
            <img
              src={imageUrl}
              alt="NookAI 生成效果图"
              className="w-full h-auto object-contain block"
            />

            {products.map((product) => (
              <motion.button
                key={product.id}
                type="button"
                onClick={() => setActive(product)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={spring}
                className={`absolute ${product.position} -translate-x-1/2 -translate-y-1/2`}
              >
                <motion.span
                  className="absolute inset-0 rounded-full border border-white/70"
                  animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <span className="relative block h-3 w-3 rounded-full bg-white shadow-md" />
              </motion.button>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-center text-stone-500">
            还没有效果图，请先返回上传页面。
          </div>
        )}
      </div>

      <AnimatePresence>
        {active ? (
          <>
            <motion.div
              className="fixed inset-0 z-40 bg-black/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActive(null)}
            />
            <motion.div
              className="fixed bottom-0 left-0 right-0 z-50"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={spring}
            >
              <div className="max-w-md mx-auto rounded-t-3xl bg-white p-5 shadow-2xl">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-stone-800">{active.name}</h2>
                    <p className="mt-1 text-sm text-stone-500">{active.description}</p>
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => setActive(null)}
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.92 }}
                    transition={spring}
                    className="rounded-full border border-stone-200 p-2"
                  >
                    <X size={18} className="text-stone-600" />
                  </motion.button>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xl font-semibold text-orange-500">{active.price}</p>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    transition={spring}
                    className="rounded-full bg-orange-400 px-6 py-2 text-sm font-semibold text-white shadow-lg"
                  >
                    去购买
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
