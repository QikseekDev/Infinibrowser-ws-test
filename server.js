import express from "express";
import WebSocket from "ws";
import cors from "cors";

const app = express();

app.use(cors());

const PORT = process.env.PORT || 3000;


function searchInfini(query) {

    return new Promise((resolve, reject)=>{

        const ws = new WebSocket(
            "wss://infinibrowser.wiki/api/ws"
        );

        let done = false;

        ws.on("open", ()=>{

            ws.send(JSON.stringify({
                op:"identify",
                data:{
                    client:"JSON-API",
                    version:2,
                    token:null
                }
            }));

            setTimeout(()=>{

                ws.send(JSON.stringify({
                    op:"search",
                    nonce:1,
                    data:{
                        offset:0,
                        internal_offset:0,
                        query,
                        sort:"time",
                        order:"ascending"
                    }
                }));

            },300);

        });


        ws.on("message", data=>{

            const msg = JSON.parse(data);


            if(msg.op === "search" && !done){

                done = true;

                resolve(msg.data.items);

                ws.close();
            }

        });


        ws.on("error", err=>{
            if(!done){
                done=true;
                reject(err);
            }
        });


        setTimeout(()=>{
            if(!done){
                done=true;
                reject(new Error("Timeout"));
                ws.close();
            }
        },10000);

    });
}



app.get("/", async (req,res)=>{

    const id = req.query.id;

    if(!id){
        return res.json({
            error:"Missing ?id="
        });
    }


    try{

        const items = await searchInfini(id);


        res.json({
            query:id,
            items
        });


    }catch(e){

        res.status(500).json({
            error:e.message
        });

    }

});



app.listen(PORT,()=>{
    console.log(`Running on port ${PORT}`);
});
