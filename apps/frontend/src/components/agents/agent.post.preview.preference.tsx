'use client';

import React, {
  createContext,
  FC,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useCopilotReadable } from '@copilotkit/react-core';

const STORAGE_KEY = 'agent.chat.postPreview.enabled';

type AgentPostPreviewPreferenceContextValue = {
  postPreviewEnabled: boolean;
  setPostPreviewEnabled: (next: boolean) => void;
};

const AgentPostPreviewPreferenceContext =
  createContext<AgentPostPreviewPreferenceContextValue | null>(null);

export const AgentPostPreviewPreferenceProvider: FC<{
  children: ReactNode;
}> = ({ children }) => {
  const [postPreviewEnabled, setState] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === '0' || raw === '1') {
        setState(raw === '1');
      }
    } catch {
      // ignore
    }
  }, []);

  const setPostPreviewEnabled = useCallback((next: boolean) => {
    setState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(
    () => ({ postPreviewEnabled, setPostPreviewEnabled }),
    [postPreviewEnabled, setPostPreviewEnabled]
  );

  useCopilotReadable(
    {
      description:
        'Whether the user has enabled in-chat post preview cards in the composer. When false, do not rely on post preview cards being visible; prefer plain markdown.',
      value: postPreviewEnabled,
    },
    [postPreviewEnabled]
  );

  return (
    <AgentPostPreviewPreferenceContext.Provider value={value}>
      {children}
    </AgentPostPreviewPreferenceContext.Provider>
  );
};

export function useAgentPostPreviewPreference(): AgentPostPreviewPreferenceContextValue {
  const ctx = useContext(AgentPostPreviewPreferenceContext);
  if (!ctx) {
    throw new Error(
      'useAgentPostPreviewPreference must be used within AgentPostPreviewPreferenceProvider'
    );
  }
  return ctx;
}
