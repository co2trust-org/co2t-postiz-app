'use client';
import { FC, useEffect, useRef, useState } from 'react';
import {
  ProviderPreviewComponent,
  type ProviderPreviewHandle,
  type ProviderPreviewProps,
  type ProviderPreviewValidation,
} from '@gitroom/frontend/components/provider-preview/preview.provider.component';

type InitPayload = {
  value?: Record<string, unknown>;
  errors?: string[];
  integration?: ProviderPreviewProps['integration'];
  /**
   * Per-post media (outer array = thread entries, inner = media items).
   * Passed to the provider's `checkValidity` function during validation.
   */
  posts?: Array<Array<{ path: string; thumbnail?: string }>>;
};

declare global {
  interface Window {
    __PROVIDER_INIT__?: InitPayload;
    __getProviderPreviewValues__?: () => Record<string, unknown>;
    __validateProviderPreview__?: () => Promise<ProviderPreviewValidation>;
    /**
     * Returns the provider's resolved character limit (number) or null when
     * the provider doesn't declare one. Resolution uses the seeded
     * __PROVIDER_INIT__.integration.additionalSettings (e.g. X bumps to
     * 4000 when {title:'Verified', value:true} is present).
     */
    __getProviderMaxCharacters__?: () => number | null;
  }
}

export const ProviderPreviewBridge: FC<{ provider: string }> = ({
  provider,
}) => {
  const [init] = useState<InitPayload>(() =>
    typeof window !== 'undefined' ? window.__PROVIDER_INIT__ ?? {} : {},
  );

  const controlRef = useRef<ProviderPreviewHandle | null>(null);

  useEffect(() => {
    window.__getProviderPreviewValues__ = () =>
      controlRef.current?.getValues() ?? {};
    window.__validateProviderPreview__ = async () =>
      controlRef.current
        ? await controlRef.current.validate()
        : {
            isValid: false,
            value: {},
            errors: ['not-ready'],
            formValid: false,
            checkValidityError: null,
          };
    window.__getProviderMaxCharacters__ = () =>
      controlRef.current?.getMaximumCharacters() ?? null;
    return () => {
      delete window.__getProviderPreviewValues__;
      delete window.__validateProviderPreview__;
      delete window.__getProviderMaxCharacters__;
    };
  }, []);

  return (
    <ProviderPreviewComponent
      provider={provider}
      value={init.value}
      errors={init.errors}
      integration={init.integration}
      posts={init.posts}
      controlRef={controlRef}
    />
  );
};
