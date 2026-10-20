// Execute module initialization without Node globals. This catches export-time
// failures (e.g. an uninlined process.env) before a broken HTML is handed off.
// This is a startup check, not a browser renderer or a visual layout test.
const vm=require('node:vm');
function checkStandalone(source){
 const mountReached=new Error('Preview mount reached');
 let reached=false;
 const surface={};
 const context={window:surface,self:surface,console,URL,URLSearchParams,Response,Request,
  setTimeout:()=>0,clearTimeout:()=>{},
  document:{getElementById(id){
   if(id!=='app')throw Error(`Unexpected preview root: ${id}`);
   reached=true;throw mountReached;
  }},
 };
 try{vm.runInNewContext(source,context,{timeout:5000,filename:'standalone-preview.js'});}
 catch(error){if(error!==mountReached)throw error;}
 if(!reached)throw Error('Standalone preview did not reach its React mount.');
}
module.exports={checkStandalone};
if(require.main===module){
 checkStandalone(require('node:fs').readFileSync(process.argv[2],'utf8'));
 console.log('Standalone preview initialization passed without Node globals.');
}
