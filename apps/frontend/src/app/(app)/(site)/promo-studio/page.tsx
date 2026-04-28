import { PromoStudioComponent } from '@gitroom/frontend/components/promo-studio/promo-studio.component';
import { Metadata } from 'next';
import { isGeneralServerSide } from '@gitroom/helpers/utils/is.general.server.side';

export const metadata: Metadata = {
  title: `${isGeneralServerSide() ? 'Postiz' : 'Gitroom'} Promo Studio`,
  description: '',
};

export default function Page() {
  return (
    <div className="bg-newBgColorInner p-[20px] flex flex-1 flex-col gap-[15px] transition-all">
      <PromoStudioComponent />
    </div>
  );
}
