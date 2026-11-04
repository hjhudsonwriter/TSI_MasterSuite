const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1920,height:1575}});
const svg=fs.readFileSync(process.argv[2],'utf8');
await p.setContent('<html><body style="margin:0;background:transparent">'+svg.replace('<svg ','<svg style="width:1920px;height:auto;display:block" ')+'</body></html>');
await p.locator('svg').screenshot({path:process.argv[3],omitBackground:true});await b.close()})();
