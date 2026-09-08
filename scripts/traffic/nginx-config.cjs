// nginx -T 출력은 이 모듈 내부에서만 처리하며 원문을 로그에 출력하지 않는다.
const path = require('node:path');
function tokenize(source) {
  const tokens=[]; let i=0;
  while(i<source.length) {
    if(/\s/.test(source[i])){i++;continue;}
    if(source[i]==='#'){while(i<source.length&&source[i]!=='\n')i++;continue;}
    if('{};'.includes(source[i])){tokens.push(source[i++]);continue;}
    let token='';const quote=['"',"'"].includes(source[i])?source[i++]:null;
    while(i<source.length){const c=source[i];if(quote&&c===quote){i++;break;}if(!quote&&(/\s/.test(c)||'{};#'.includes(c)))break;if(c==='\\'&&i+1<source.length){token+=source[i+1];i+=2;}else{token+=c;i++;}}
    if(!token&&!quote)throw Error('Unsupported nginx token');tokens.push({value:token});
  }return tokens;
}
function parse(source){const tokens=tokenize(source);let i=0;
 function block(nested){const out=[];while(i<tokens.length){if(tokens[i]==='}'){if(!nested)throw Error('Unexpected nginx brace');i++;return out;}const words=[];while(i<tokens.length&&typeof tokens[i]==='object')words.push(tokens[i++].value);if(!words.length)throw Error('Malformed nginx directive');const stop=tokens[i++];if(stop===';')out.push({name:words[0],args:words.slice(1)});else if(stop==='{')out.push({name:words[0],args:words.slice(1),children:block(true)});else throw Error('Unterminated nginx directive');}if(nested)throw Error('Unterminated nginx block');return out;}
 return block(false);
}
function globMatch(pattern,file){const regex=pattern.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[^/]*');return new RegExp('^'+regex+'$').test(file);}
function inspectConfig(dump){const files=new Map();let current=null;for(const line of dump.split('\n')){const m=line.match(/^# configuration file (\/[^:]+):$/);if(m){current=m[1];files.set(current,'');}else if(current)files.set(current,files.get(current)+line+'\n');}
 if(!files.size)throw Error('Cannot inspect nginx configuration');
 const ast=new Map([...files].map(([file,s])=>[file,parse(s)]));const main=[...files.keys()][0];
 function expand(nodes,chain=[]){return nodes.flatMap(node=>{if(node.name==='include'){const pattern=path.resolve('/etc/nginx',node.args[0]);const matched=[...ast.keys()].filter(f=>globMatch(pattern,f));return matched.flatMap(file=>{if(chain.includes(file))throw Error('Recursive nginx include');return expand(ast.get(file),[...chain,file]);});}return [{...node,children:node.children?expand(node.children,chain):undefined}];});}
 const raw=ast.get(main),http=raw.find(n=>n.name==='http');if(!http)throw Error('No nginx http block');
 if(!http.children.some(n=>n.name==='include'&&globMatch(path.resolve('/etc/nginx',n.args[0]),'/etc/nginx/conf.d/blendpick-traffic.conf')))throw Error('Expected http conf.d include missing');
 const expanded=expand(http.children,[main]);const servers=expanded.filter(n=>n.name==='server');const found=new Set();let overrides=0;
 function hasOverride(nodes){return nodes.some(n=>n.name==='access_log'||n.children&&hasOverride(n.children));}
 for(const server of servers){const hosts=server.children.filter(n=>n.name==='server_name').flatMap(n=>n.args);const targets=hosts.filter(h=>['shop.blendpunch.com','sanjipick.blendpunch.com'].includes(h));if(targets.length){targets.forEach(h=>found.add(h));if(hasOverride(server.children))overrides++;}}
 if(found.size!==2)throw Error('Both storefront server blocks must exist');
 if(overrides)throw Error('Storefront overrides access_log; explicit inheritance review required');
 return {sites:[...found].sort(),serverBlocks:servers.length,overrides};
}
module.exports={parse,inspectConfig};
