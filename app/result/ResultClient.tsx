'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Cat } from 'lucide-react';
import { loadResult, type StoredResult } from '../lib/imageStore';

const spring = { type: 'spring', stiffness: 260, damping: 22 } as const;

export default function ResultClient() {
  const [imageUrl, setImageUrl] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [theme, setTheme] = useState('');
  const [isPressing, setIsPressing] = useState(false);

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
      <div className="w-full max-w-6xl mx-auto px-4 md:px-12 lg:px-16 pt-6">
        <header className="flex items-center justify-between mb-6">
          <div>
            <p className="text-sm text-stone-500">NookAI 效果图</p>
            <h1 className="text-xl font-semibold text-stone-800">猫咪包工头已完工</h1>
          </div>
          <Cat className="text-orange-500" size={30} />
        </header>

        {imageUrl ? (
          <div className="space-y-5">
            <div className="rounded-2xl bg-white/90 p-4 shadow-lg">
              <p className="text-xs text-stone-500 mb-3">
                按住按钮查看原图，松开回到效果图。
              </p>
              <div className="relative overflow-hidden rounded-2xl border border-stone-100">
                <img
                  src={isPressing && originalUrl ? originalUrl : imageUrl}
                  alt={isPressing ? '原始照片' : 'NookAI 生成效果图'}
                  className="w-full h-auto object-contain block"
                />
              </div>
              <motion.button
                type="button"
                onPointerDown={() => setIsPressing(true)}
                onPointerUp={() => setIsPressing(false)}
                onPointerLeave={() => setIsPressing(false)}
                onPointerCancel={() => setIsPressing(false)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                className="mt-4 w-full rounded-2xl border border-orange-200 bg-amber-50 px-5 py-3 text-sm font-semibold text-stone-700"
              >
                按住查看原图
              </motion.button>
              {!originalUrl ? (
                <p className="mt-2 text-xs text-amber-700">
                  未找到原图，请从上传页重新生成以保存原图。
                </p>
              ) : null}
            </div>

            <div className="rounded-2xl bg-white/90 p-4 shadow-lg">
              <h2 className="text-sm font-semibold text-stone-700">氛围改造建议</h2>
              <ul className="mt-3 space-y-2 text-sm text-stone-600">
                {tips.map((tip) => (
                  <li key={tip}>• {tip}</li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white p-8 text-center text-stone-500">
            还没有效果图，请先返回上传页面。
          </div>
        )}
      </div>
    </div>
  );
}
