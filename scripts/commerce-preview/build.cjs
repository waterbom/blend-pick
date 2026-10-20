// Uses the repository's pinned Next/webpack dependency; no extra package install.
const path=require('node:path');
const {webpack,LimitChunkCountPlugin}=require('next/dist/compiled/webpack/webpack');
const root=path.resolve(__dirname,'../..'),navigation=path.join(__dirname,'navigation.tsx');
const compiler=webpack({mode:'production',target:'web',devtool:false,context:root,entry:path.join(__dirname,'main.tsx'),
 output:{path:'/tmp',filename:'commerce-preview.js'},resolve:{extensions:['.tsx','.ts','.js'],alias:{'@':root,'next/link$':navigation,'next/navigation$':navigation}},
 module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(__dirname,'typescript-loader.cjs')}]},
 optimization:{minimize:false,splitChunks:false,runtimeChunk:false},plugins:[new LimitChunkCountPlugin({maxChunks:1})]});
compiler.run((error,stats)=>{const failed=error||stats?.hasErrors();if(failed)console.error(error||stats.toString({all:false,errors:true}));else console.log('Interactive overview preview bundled.');compiler.close(()=>{if(failed)process.exitCode=1;});});
