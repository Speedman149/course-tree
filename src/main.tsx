import {hydrateRoot} from 'react-dom/client';
import ApplicationRoot from './ApplicationRoot';
import {upgradeLegacyRoute, type AppRoute} from './lib/navigation';
upgradeLegacyRoute();
const container=document.getElementById('root')!;
const savedRoute=container.dataset.initialRoute;
const initialRoute:AppRoute=savedRoute==='about'||savedRoute==='feedback'?savedRoute:'tree';
hydrateRoot(container,<ApplicationRoot initialRoute={initialRoute}/>,{identifierPrefix:'branchquest-'});
