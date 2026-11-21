import { useContext } from 'react';
import { BaseEdge, EdgeLabelRenderer, Position, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import { Minus } from 'lucide-react';
import { ExplorerContext } from './CourseNode';

type BranchEdge = Edge<{
  connectionId: string;
  parentInstanceId: string;
  childCourseId: string;
  parentCourseId: string;
  forward: boolean;
  parallelOffset?: number;
}, 'branch'>;

export default function ForwardBranchEdge(props: EdgeProps<BranchEdge>) {
  const explorer = useContext(ExplorerContext);
  const data = props.data;
  const offset = data?.parallelOffset ?? 0;
  const sourceY = props.sourceY + offset;
  const targetY = props.targetY + offset;
  const [ordinaryPath] = getSmoothStepPath({ ...props, sourceY, targetY, borderRadius: 16 });
  const path = props.source === props.target
    ? `M ${props.sourceX} ${sourceY} C ${props.sourceX - 80} ${sourceY - 150}, ${props.targetX + 80} ${targetY - 150}, ${props.targetX} ${targetY}`
    : ordinaryPath;
  const x = props.targetX + (props.targetPosition === Position.Right ? 26 : props.targetPosition === Position.Left ? -26 : 0);
  const y = targetY + (props.targetPosition === Position.Bottom ? 26 : props.targetPosition === Position.Top ? -26 : 0);
  return <>
    <BaseEdge id={props.id} path={path} style={props.style} markerEnd={props.markerEnd} markerStart={props.markerStart}/>
    {data?.forward && <EdgeLabelRenderer><button className="edge-branch-toggle nodrag nopan" data-connection={data.connectionId}
      style={{ transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}
      aria-label={`הסתרת הענף ${data.childCourseId} דרך ${data.parentCourseId}`}
      title={`הסתרת החיבור הזה בלבד — ${explorer.courses.get(data.childCourseId)?.name ?? data.childCourseId}`}
      onPointerDown={event => event.stopPropagation()}
      onClick={event => { event.stopPropagation(); explorer.hideForwardConnection(data.connectionId, data.parentInstanceId); }}><Minus size={12}/></button></EdgeLabelRenderer>}
  </>;
}
