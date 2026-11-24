import {ReactFlowProvider} from '@xyflow/react';
import {Analytics} from '@vercel/analytics/react';
import App from './App';
import {redactAnalyticsEvent} from './lib/analytics';
export default function InteractiveApplication(){
 return <><ReactFlowProvider><App/></ReactFlowProvider><Analytics beforeSend={redactAnalyticsEvent}/></>;
}
