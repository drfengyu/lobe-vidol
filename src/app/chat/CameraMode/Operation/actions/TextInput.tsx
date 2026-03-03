'use client';

import { SendOutlined } from '@ant-design/icons';
import { Button, Input } from 'antd';
import { useTheme } from 'antd-style';
import { memo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Flexbox } from 'react-layout-kit';

import StopLoadingIcon from '@/components/StopLoading';
import useChatInput from '@/hooks/useSendMessage';
import { useSessionStore } from '@/store/session';

const { TextArea } = Input;

const CameraTextInput = memo(() => {
  const onSend = useChatInput();
  const theme = useTheme();
  const { t } = useTranslation('chat');
  const isChineseInput = useRef(false);

  const [loading, messageInput, setMessageInput, stopGenerateMessage] = useSessionStore((s) => [
    !!s.chatLoadingId,
    s.messageInput,
    s.setMessageInput,
    s.stopGenerateMessage,
  ]);

  return (
    <Flexbox
      horizontal
      gap={8}
      align={'flex-end'}
      style={{
        width: '100%',
        maxWidth: 600,
        padding: '8px 12px',
        borderRadius: theme.borderRadiusLG,
        background: theme.colorBgElevated,
        boxShadow: theme.boxShadowSecondary,
      }}
    >
      <TextArea
        autoSize={{ minRows: 1, maxRows: 5 }}
        style={{ flex: 1, resize: 'none', background: 'transparent', border: 'none', boxShadow: 'none' }}
        placeholder={t('input.placeholder')}
        value={messageInput}
        onChange={(e) => setMessageInput(e.target.value)}
        onCompositionStart={() => {
          isChineseInput.current = true;
        }}
        onCompositionEnd={() => {
          isChineseInput.current = false;
        }}
        onPressEnter={(e) => {
          if (loading || e.shiftKey || isChineseInput.current) return;
          e.preventDefault();
          onSend();
        }}
      />
      <Button
        type={loading ? undefined : 'primary'}
        icon={loading ? <StopLoadingIcon /> : <SendOutlined />}
        onClick={() => {
          if (loading) {
            stopGenerateMessage();
          } else {
            onSend();
          }
        }}
      />
    </Flexbox>
  );
});

export default CameraTextInput;
