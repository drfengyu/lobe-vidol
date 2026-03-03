'use client';

import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import CallOff from './actions/CallOff';
import PlaySequence from './actions/PlaySequence';
import Record from './actions/Record';
import Setting from './actions/Setting';
import TextInput from './actions/TextInput';

const VoiceOperation = memo(() => {
  return (
    <Flexbox gap={12} align={'center'} style={{ width: '100%' }}>
      <TextInput />
      <Flexbox gap={24} horizontal align={'center'}>
        <PlaySequence />
        <CallOff />
        <Record />
        <Setting />
      </Flexbox>
    </Flexbox>
  );
});

export default VoiceOperation;
