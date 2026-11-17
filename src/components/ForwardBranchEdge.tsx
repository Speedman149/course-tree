import {useContext} from 'react';
import {BaseEdge,EdgeLabelRenderer,Position,getSmoothStepPath,type Edge,type EdgeProps} from '@xyflow/react';
import {Minus} from 'lucide-react';
import {ExplorerContext} from './CourseNode';

type BranchEdge=Edge<{connectionId:string;parentInstanceId:string;childCourseId:string;parentCourseId:string},'branch'>;
/** Only forward edges use this renderer. Backward edges retain their existing controls. */
export default function ForwardBranchEdge(props:EdgeProps<BranchEdge>){
 const explorer=useContext(ExplorerContext);
 const [path]=getSmoothStepPath({...props,borderRadius:16});
 const data=props.data;
 const x=props.targetX+(props.targetPosition===Position.Right?26:props.targetPosition===Position.Left?-26:0);
 const y=props.targetY+(props.targetPosition===Position.Bottom?26:props.targetPosition===Position.Top?-26:0);
 return <>
  <BaseEdge id={props.id} path={path} style={props.style} markerEnd={props.markerEnd} markerStart={props.markerStart}/>
  {data&&<EdgeLabelRenderer><button className="edge-branch-toggle nodrag nopan" data-connection={data.connectionId}
    style={{transform:`translate(-50%, -50%) translate(${x}px, ${y}px)`}}
    aria-label={`הסתרת הענף ${data.childCourseId} דרך ${data.parentCourseId}`}
    title={`הסתרת הענף הזה בלבד — ${explorer.courses.get(data.childCourseId)?.name??data.childCourseId}`}
    onPointerDown={event=>event.stopPropagation()}
    onClick={event=>{event.stopPropagation();explorer.hideForwardConnection(data.connectionId,data.parentInstanceId);}}><Minus size={12}/></button></EdgeLabelRenderer>}
 </>;
}