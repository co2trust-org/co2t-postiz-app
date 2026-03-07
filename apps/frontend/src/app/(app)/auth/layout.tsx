export const dynamic = 'force-dynamic';
import { ReactNode } from 'react';
import loadDynamic from 'next/dynamic';
const ReturnUrlComponent = loadDynamic(() => import('./return.url.component'));
export default function AuthLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="bg-[#0E0E0E] flex flex-1 p-[12px] min-h-screen w-screen text-white">
      {/*<style>{`html, body {overflow-x: hidden;}`}</style>*/}
      <ReturnUrlComponent />
      <div className="flex flex-col py-[40px] px-[20px] flex-1 rounded-[12px] text-white p-[12px] bg-[#1A1919]">
        <div className="w-full max-w-[440px] mx-auto justify-center gap-[20px] h-full flex flex-col text-white">
          <div className="text-[28px] font-[600] tracking-[-0.6px] text-center">
            share.CO2T.earth
          </div>
          <div className="flex">{children}</div>
        </div>
      </div>
    </div>
  );
}
