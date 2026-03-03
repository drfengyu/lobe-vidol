'use client';

import { ActionIcon } from '@lobehub/ui';
import { Dropdown } from 'antd';
import { Play } from 'lucide-react';
import { memo } from 'react';
import { useTheme } from 'antd-style';
import { Flexbox } from 'react-layout-kit';

import { DESKTOP_OPERATION_ICON_SIZE } from '@/constants/token';
import { MOTION_SEQUENCES, type MotionSequenceId } from '@/config/motionSequences';
import { useGlobalStore } from '@/store/global';

const SEQUENCE_LABELS: Record<MotionSequenceId, string> = {
  intro: '开场介绍',
  explainPoints: '讲解列举',
  pointing: '指向系列',
  happy: '开心互动',
};

const PlaySequence = memo(() => {
  const viewer = useGlobalStore((s) => s.viewer);
  const theme = useTheme();

  const items = Object.entries(MOTION_SEQUENCES).map(([id, sequence]) => ({
    key: id,
    label: SEQUENCE_LABELS[id as MotionSequenceId],
    onClick: () => {
      viewer.model?.playMotionSequence([...sequence], () => {
        viewer.model?.loadIdleAnimation();
      });
    },
  }));

  return (
    <Dropdown menu={{ items }} trigger={['click']} placement="top">
      <Flexbox style={{ display: 'inline-flex' }}>
        <ActionIcon
          icon={Play}
          placement="bottom"
          size={DESKTOP_OPERATION_ICON_SIZE}
          style={{ backgroundColor: theme.colorBgElevated }}
          title="播放动作序列"
        />
      </Flexbox>
    </Dropdown>
  );
});

PlaySequence.displayName = 'PlaySequence';

export default PlaySequence;
