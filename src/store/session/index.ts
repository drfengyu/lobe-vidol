import { DeepPartial } from '@trpc/server';
import { nanoid } from 'ai';
import dayjs from 'dayjs';
import { produce } from 'immer';
import { PersistOptions, createJSONStorage, devtools, persist } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';
import { StateCreator } from 'zustand/vanilla';

import {
  DEFAULT_CHAT_CONFIG,
  DEFAULT_LLM_CONFIG,
  LOBE_VIDOL_DEFAULT_AGENT_ID,
} from '@/constants/agent';
import { DEFAULT_USER_AVATAR_URL, LOADING_FLAG } from '@/constants/common';
import { chatCompletion, handleSpeakAi, handleStopSpeak } from '@/services/chat';
import { shareService } from '@/services/share';
import { Agent } from '@/types/agent';
import { ChatMessage } from '@/types/chat';
import { OpenAIChatMessage } from '@/types/provider/chat';
import { Session, SessionChatConfig } from '@/types/session';
import { ShareGPTConversation } from '@/types/share';
import { merge } from '@/utils/merge';
import { vidolStorage } from '@/utils/storage';

import { useAgentStore } from '../agent';
import { useGlobalStore } from '../global';
import { chatHelpers } from './helpers';
import { initialState } from './initialState';
import { MessageActionType, messageReducer } from './reducers/message';
import { sessionSelectors } from './selectors';

export const SESSION_STORAGE_KEY = 'vidol-chat-session-storage';

interface ShareMessage {
  from: 'human' | 'gpt';
  value: string;
}

const Footer: ShareMessage = {
  from: 'gpt',
  value: `Share from [**🤯 LobeVidol**](https://github.com/lobehub/lobe-vidol) - ${dayjs().format(
    'YYYY-MM-DD',
  )}`,
};

export interface SessionStore {
  abortController?: AbortController;
  activeId: string;
  chatLoadingId: string | undefined;
  clearHistory: () => void;
  clearSessionStorage: () => Promise<void>;
  createSession: (agent: Agent) => void;
  defaultSession: Session;
  delAndRegenerateMessage: (id: string) => void;
  deleteMessage: (id: string) => void;
  dispatchMessage: (payload: MessageActionType) => void;
  fetchAIResponse: (messages: ChatMessage[], assistantId: string) => void;
  interactive: boolean;
  messageInput: string;
  regenerateMessage: (id: string) => void;
  removeSessionByAgentId: (id: string) => void;
  sendMessage: (message: string) => void;
  sessionList: Session[];
  setMessageInput: (messageInput: string) => void;
  shareLoading: boolean;
  shareToShareGPT: (props: { withSystemRole?: boolean }) => Promise<void>;
  stopGenerateMessage: () => void;
  stopTtsMessage: () => void;
  switchSession: (agentId: string) => void;
  toggleInteractive: () => void;
  ttsLoadingId: string | undefined;
  ttsMessage: (id: string, content: string) => void;
  updateMessage: (id: string, content: string) => void;
  updateSessionChatConfig: (config: DeepPartial<SessionChatConfig>) => void;
  updateSessionConfig: (config: DeepPartial<Session['config']>) => void;
  updateSessionMessages: (messages: ChatMessage[]) => void;
}

export const createSessionStore: StateCreator<SessionStore, [['zustand/devtools', never]]> = (
  set,
  get,
) => ({
  ...initialState,
  clearHistory: () => {
    const { updateSessionMessages } = get();
    updateSessionMessages([]);
  },
  clearSessionStorage: async () => {
    await vidolStorage.removeItem(SESSION_STORAGE_KEY);
    set({ ...initialState });
  },
  createSession: (agent: Agent) => {
    const { sessionList, switchSession } = get();

    const newSessionList = produce(sessionList, (draft) => {
      const index = draft.findIndex((session) => session.agentId === agent.agentId);
      if (index === -1) {
        const session = {
          agentId: agent.agentId,
          messages: [],
          config: {
            chatConfig: DEFAULT_CHAT_CONFIG,
          },
        };
        draft.unshift(session);
      }
    });

    set({ sessionList: newSessionList });
    switchSession(agent.agentId);
  },
  deleteMessage: (id) => {
    const { dispatchMessage } = get();
    dispatchMessage({
      payload: { id },
      type: 'DELETE_MESSAGE',
    });
  },
  delAndRegenerateMessage: (id) => {
    const { deleteMessage, regenerateMessage } = get();
    deleteMessage(id);
    regenerateMessage(id);
  },

  dispatchMessage: (payload) => {
    const { updateSessionMessages } = get();
    const session = sessionSelectors.currentSession(get());

    if (!session) return;

    const messages = messageReducer(session.messages, payload);
    updateSessionMessages(messages);
  },

  // ========== 修复 stopGenerateMessage：添加防御性检查并清除 controller ==========
  stopGenerateMessage: () => {
    const { abortController } = get();
    if (abortController && typeof abortController.abort === 'function') {
      abortController.abort();
    } else if (abortController) {
      console.warn('[SessionStore] stopGenerateMessage: abortController is invalid', abortController);
    }
    set({ chatLoadingId: undefined, abortController: undefined });
  },

  // ========== 修复 fetchAIResponse：使用 try...finally 确保清理 controller ==========
  fetchAIResponse: async (messages, assistantId) => {
    const { dispatchMessage } = get();
    const currentSession = sessionSelectors.currentSession(get());
    const currentAgent = sessionSelectors.currentAgent(get());

    if (!currentSession || !currentAgent) return;

    const abortController = new AbortController();
    set({ chatLoadingId: assistantId, abortController });

    let receivedMessage = '';
    let aiMessage = '';
    const sentences: string[] = [];

    const { voiceOn, chatMode } = useGlobalStore.getState();

    const chatConfig = sessionSelectors.currentSessionChatConfig(get());
    const preprocessMsgs = chatHelpers.getSlicedMessagesWithConfig(messages, chatConfig, true);

    if (currentAgent.systemRole) {
      preprocessMsgs.unshift({ content: currentAgent.systemRole, role: 'system' } as ChatMessage);
    }

    const postMessages: OpenAIChatMessage[] = preprocessMsgs.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    try {
      await chatCompletion(
        {
          model: currentAgent.model || DEFAULT_LLM_CONFIG.model,
          provider: currentAgent.provider || DEFAULT_LLM_CONFIG.provider,
          stream: true,
          ...(currentAgent.params || DEFAULT_LLM_CONFIG.params),
          messages: postMessages,
        },
        {
          onErrorHandle: (error) => {
            dispatchMessage({
              payload: { id: assistantId, key: 'error', value: error },
              type: 'UPDATE_MESSAGE',
            });
          },
          onMessageHandle: async (chunk) => {
            switch (chunk.type) {
              case 'text': {
                if (voiceOn && chatMode === 'camera') {
                  receivedMessage += chunk.text;
                  const sentenceMatch = receivedMessage.match(/^(.+[\n~。！．？]|.{10,}[,、])/);
                  if (sentenceMatch && sentenceMatch[0]) {
                    const sentence = sentenceMatch[0];
                    sentences.push(sentence);
                    receivedMessage = receivedMessage.slice(sentence.length).trimStart();

                    if (
                      !sentence.replaceAll(
                        /^[\s()[\]}«»‹›〈〉《》「」『』【】〔〕〘〙〚〛（）［］｛]+$/g,
                        '',
                      )
                    ) {
                      return;
                    }
                    handleSpeakAi(sentence);
                  }
                }

                aiMessage += chunk.text;
                dispatchMessage({
                  payload: { id: assistantId, key: 'content', value: aiMessage },
                  type: 'UPDATE_MESSAGE',
                });
                break;
              }
              // case 'tool_calls': ... 保持不变
            }
          },
          signal: abortController.signal,
        },
      );
    } finally {
      // 确保无论成功、失败还是中止，都清理 loading 状态和 controller
      set({ chatLoadingId: undefined, abortController: undefined });
    }
  },

  ttsMessage: async (id: string, content: string) => {
    set({ ttsLoadingId: id });
    await handleSpeakAi(content, {
      onComplete: () => set({ ttsLoadingId: undefined }),
      onError: () => set({ ttsLoadingId: undefined }),
    });
  },
  stopTtsMessage: () => {
    set({ ttsLoadingId: undefined });
    handleStopSpeak();
  },
  shareToShareGPT: async ({ withSystemRole }) => {
    const messages = sessionSelectors.currentChats(get());
    const agent = sessionSelectors.currentAgent(get());
    const meta = agent?.meta;

    if (!agent || !meta) return;

    const defaultMsg: ShareGPTConversation['items'] = [];
    const showSystemRole = withSystemRole && !!agent.systemRole;
    const shareMsgs = produce(defaultMsg, (draft) => {
      draft.push({
        from: 'gpt',
        value: [
          `${meta.avatar} **${meta.name}** - ${meta.description}`,
          showSystemRole && '---',
          showSystemRole && agent.systemRole,
        ]
          .filter(Boolean)
          .join('\n\n'),
      });

      for (const i of messages) {
        if (i.role === 'assistant') {
          draft.push({ from: 'gpt', value: i.content });
        } else if (i.role === 'user') {
          draft.push({ from: 'human', value: i.content });
        }
      }
      draft.push(Footer);
    });

    set({ shareLoading: true });
    const res = await shareService.createShareGPTUrl({
      avatarUrl: DEFAULT_USER_AVATAR_URL,
      items: shareMsgs,
    });
    set({ shareLoading: false });
    window.open(res, '_blank');
  },
  regenerateMessage: (id) => {
    const { dispatchMessage, fetchAIResponse } = get();
    const currentSession = sessionSelectors.currentSession(get());
    if (!currentSession) return;

    const chats = sessionSelectors.currentChats(get());
    const currentIndex = chats.findIndex((item) => item.id === id);
    const currentMessage = chats[currentIndex];

    let contextMessages: ChatMessage[] = [];

    switch (currentMessage.role) {
      case 'user': {
        contextMessages = chats.slice(0, currentIndex + 1);
        break;
      }
      case 'assistant': {
        const userId = currentMessage.parentId;
        const userIndex = chats.findIndex((c) => c.id === userId);
        contextMessages = chats.slice(0, userIndex < 0 ? currentIndex + 1 : userIndex + 1);
        break;
      }
    }

    const latestMsg = contextMessages.findLast((s) => s.role === 'user');
    if (!latestMsg) return;

    const assistantId = nanoid();
    dispatchMessage({
      payload: {
        content: LOADING_FLAG,
        id: assistantId,
        parentId: latestMsg.id,
        role: 'assistant',
      },
      type: 'ADD_MESSAGE',
    });

    fetchAIResponse(contextMessages, assistantId);
  },
  removeSessionByAgentId: (id) => {
    const { sessionList, activeId } = get();
    const sessions = produce(sessionList, (draft) => {
      const index = draft.findIndex((session) => session.agentId === id);
      if (index !== -1) draft.splice(index, 1);
    });
    set({ sessionList: sessions });
    if (activeId === id) set({ activeId: LOBE_VIDOL_DEFAULT_AGENT_ID });
  },

  // ========== 修复 sendMessage：在发送前停止当前生成 ==========
  sendMessage: async (message: string) => {
    const { stopGenerateMessage, dispatchMessage, fetchAIResponse } = get();
    // 停止当前正在进行的 AI 回复
    stopGenerateMessage();

    const currentSession = sessionSelectors.currentSession(get());
    if (!currentSession) return;

    const userId = nanoid();
    dispatchMessage({
      payload: { content: message, id: userId, role: 'user' },
      type: 'ADD_MESSAGE',
    });

    const currentChats = sessionSelectors.currentChats(get());
    const assistantId = nanoid();
    dispatchMessage({
      payload: {
        content: LOADING_FLAG,
        id: assistantId,
        parentId: userId,
        role: 'assistant',
      },
      type: 'ADD_MESSAGE',
    });

    fetchAIResponse(currentChats, assistantId);
  },

  setMessageInput: (messageInput) => {
    set({ messageInput }, false, 'session/setMessageInput');
  },
  switchSession: (agentId) => {
    if (get().activeId === agentId) return;
    set({ activeId: agentId });
    useAgentStore.setState({ currentIdentifier: agentId }, false, `switchSession/${agentId}`);
  },
  toggleInteractive: () => {
    const { interactive: touchOn } = get();
    set({ interactive: !touchOn });
  },
  updateMessage: (id, content) => {
    const { dispatchMessage } = get();
    dispatchMessage({
      payload: { id, key: 'content', value: content },
      type: 'UPDATE_MESSAGE',
    });
  },
  updateSessionConfig: (config) => {
    const { sessionList, activeId, defaultSession } = get();
    if (activeId === LOBE_VIDOL_DEFAULT_AGENT_ID) {
      const mergeSession = produce(defaultSession, (draft) => {
        draft.config = merge(draft.config, config);
      });
      set({ defaultSession: mergeSession });
    } else {
      const sessions = produce(sessionList, (draft) => {
        const index = draft.findIndex((session) => session.agentId === activeId);
        if (index !== -1) draft[index].config = merge(draft[index].config, config);
      });
      set({ sessionList: sessions });
    }
  },
  updateSessionChatConfig: (config) => {
    const { updateSessionConfig } = get();
    updateSessionConfig({ chatConfig: config });
  },
  updateSessionMessages: (messages) => {
    const { sessionList, activeId, defaultSession } = get();
    if (activeId === LOBE_VIDOL_DEFAULT_AGENT_ID) {
      const mergeSession = produce(defaultSession, (draft) => {
        draft.messages = messages;
      });
      set({ defaultSession: mergeSession });
    } else {
      const sessions = produce(sessionList, (draft) => {
        const index = draft.findIndex((session) => session.agentId === activeId);
        if (index !== -1) draft[index].messages = messages;
      });
      set({ sessionList: sessions });
    }
  },
});

const persistOptions: PersistOptions<SessionStore> = {
  name: SESSION_STORAGE_KEY,
  storage: createJSONStorage(() => vidolStorage),
  version: 0,
};

export const useSessionStore = createWithEqualityFn<SessionStore>()(
  persist(
    devtools(createSessionStore, { name: 'VIDOL_SESSION_STORE' }),
    persistOptions,
  ),
  shallow,
);

export { sessionSelectors } from './selectors';
