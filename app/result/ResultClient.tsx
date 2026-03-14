'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Cat, X } from 'lucide-react';
import { loadResult, type StoredResult } from '../lib/imageStore';

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

export default function ResultClient() {
  const [imageUrl, setImageUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [theme, setTheme] = useState('');
  const [active, setActive] = useState<typeof products[number] | null>(null);
  const [compareValue, setCompareValue] = useState(55);

  const tips = useMemo(() => {
    const map: Record<string, string[]> = {
      日式原木风: ['木质边几 + 低矮家具', '米色亚麻窗帘', '暖光落地灯'],
      法式复古: ['黄铜小吊灯', '浅色雕花边柜', '复古香薰与摆件'],
      极简奶油: ['奶油色抱枕', '圆角地毯', '极简壁灯'],
      奶油原木: ['原木小茶几', '奶油绒毯', '暖色台灯'],
      北欧清新: ['浅灰布艺沙发', '绿植点缀', '线性壁灯'],
      侘寂风: ['粗陶花瓶', '低饱和亚麻', '柔和间接灯带'],
    };
    return map[theme] || ['柔和灯光分区', '轻量软装搭配', '小摆件营造氛围'];
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');

    let isActive = true;

    const load = async () => {
      if (id) {
        try {
          const stored = await loadResult(id);
          if (stored && isActive) {
            setImageUrl(stored.generated);
            setOriginalUrl(stored.original);
            setTheme(stored.theme || '');
            return;
          }
        } catch {
          // Ignore and fall back to sessionStorage/query param.
        }
      }

      const stored = sessionStorage.getItem('nookai_result_image');
      if (stored && isActive) {
        try {
          const parsed = JSON.parse(stored) as StoredResult;
          setImageUrl(parsed.generated);
          setOriginalUrl(parsed.original);
          setTheme(parsed.theme || '');
          return;
        } catch {
          // Fallback below.
        }
      }

      const img = params.get('img');
      if (isActive) {
        setImageUrl(img ? decodeURIComponent(img) : '');
      }
    };

    load();

    return () => {
      isActive = false;
    };
  }, []);

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
          <div className="space-y-5">
            <div className="rounded-2xl bg-white/90 p-3 shadow-lg">
              <p className="text-xs text-stone-500 mb-2">拖动滑块对比原图与效果图</p>
              <div className="relative overflow-hidden rounded-2xl">
                {originalUrl ? (
                  <img
                    src={originalUrl}
                    alt="原始照片"
                    className="w-full h-auto object-contain block"
                  />
                ) : null}
                <div
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${compareValue}%` }}
                >
                  <img
                    src={imageUrl}
                    alt="NookAI 生成效果图"
                    className="w-full h-auto object-contain block"
                  />
                </div>
                <div
                  className="absolute inset-y-0"
                  style={{ left: `calc(${compareValue}% - 1px)` }}
                >
                  <div className="h-full w-[2px] bg-white shadow" />
                  <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow flex items-center justify-center">
                    <div className="h-4 w-4 rounded-full bg-orange-400" />
                  </div>
                </div>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={compareValue}
                onChange={(event) => setCompareValue(Number(event.target.value))}
                className="mt-4 w-full accent-orange-400"
              />
            </div>

            <div className="rounded-2xl bg-white/90 p-4 shadow-lg">
              <h2 className="text-sm font-semibold text-stone-700">氛围改造建议</h2>
              <ul className="mt-3 space-y-2 text-sm text-stone-600">
                {tips.map((tip) => (
                  <li key={tip}>• {tip}</li>
                ))}
              </ul>
            </div>

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
