// Uses the repository's pinned Next/webpack dependency; no extra package install.
const path=require('node:path');
const {webpack,LimitChunkCountPlugin}=require('next/dist/compiled/webpack/webpack');
const root=path.resolve(__dirname,'../..'),navigation=path.join(__dirname,'navigation.tsx');
// Next normally inlines these public settings. The standalone HTML has no Node
// process global; use the site's built-in defaults without copying any host env.
const publicDefaults=Object.fromEntries([
 'NEXT_PUBLIC_KAKAO_CHANNEL_URL','NEXT_PUBLIC_SITE_HOST',
 'NEXT_PUBLIC_SANJI_HOST','NEXT_PUBLIC_SANJI_KAKAO_URL',
].map(key=>[`process.env.${key}`,'undefined']));
const compiler=webpack({mode:'production',target:'web',devtool:false,context:root,entry:path.join(__dirname,'main.tsx'),
 output:{path:'/tmp',filename:'commerce-preview.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@':root,'next/link$':navigation,'next/navigation$':navigation}},
 module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(__dirname,'typescript-loader.cjs')}]},
 optimization:{minimize:false,splitChunks:false,runtimeChunk:false},plugins:[new webpack.DefinePlugin(publicDefaults),new LimitChunkCountPlugin({maxChunks:1})]});
compiler.run((error,stats)=>{const failed=error||stats?.hasErrors();if(failed)console.error(error||stats.toString({all:false,errors:true}));else console.log('Interactive overview preview bundled.');compiler.close(()=>{if(failed)process.exitCode=1;});});
