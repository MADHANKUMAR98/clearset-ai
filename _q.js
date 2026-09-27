const http=require('http');
const data=JSON.stringify({question:'Show me trade TRD-92831 with its trade value, settlement status, instruction status, risk score, and exception type.'});
const req=http.request({hostname:'localhost',port:3001,path:'/api/cortex/analyst',method:'POST',headers:{'Content-Type':'application/json','Content-Length':data.length}},(res)=>{let b='';res.on('data',c=>b+=c);res.on('end',()=>console.log(b))});req.write(data);req.end();
