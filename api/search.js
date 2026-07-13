import express from "express";
import cors from "cors";
import WebSocket from "ws";

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const cache = new Map();


// Health check
app.get("/health", (req,res)=>{
    res.json({
        status:"ok",
        time:new Date().toISOString()
    });
});



function connectInfini(query, offset, sort, order){

    return new Promise((resolve,reject)=>{

        let finished=false;


        const timeout=setTimeout(()=>{

            if(!finished){

                finished=true;

                try{
                    ws.close();
                }catch{}

                reject(
                    new Error("InfiniBrowser timeout")
                );
            }

        },15000);



        const ws=new WebSocket(
            "wss://infinibrowser.wiki/api/ws",
            {
                headers:{
                    Origin:"https://infinibrowser.wiki",
                    "User-Agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                }
            }
        );



        ws.on("open",()=>{


            ws.send(JSON.stringify({

                op:"identify",

                data:{

                    client:"InfiniBrowser/1.6",

                    version:2,

                    token:null
                }

            }));



            setTimeout(()=>{


                ws.send(JSON.stringify({

                    op:"search",

                    nonce:1,

                    data:{

                        offset:Number(offset)||0,

                        internal_offset:0,

                        query:String(query),

                        sort,

                        order

                    }

                }));


            },500);


        });



        ws.on("message",(raw)=>{


            let msg;


            try{

                msg=JSON.parse(
                    raw.toString()
                );

            }
            catch{

                return;

            }



            if(
                msg.op==="search" &&
                !finished
            ){

                finished=true;

                clearTimeout(timeout);


                resolve(
                    msg.data?.items || []
                );


                ws.close();

            }


        });



        ws.on("unexpected-response",
            (req,res)=>{

                if(!finished){

                    finished=true;

                    clearTimeout(timeout);

                    reject(
                        new Error(
                            "WebSocket rejected: "+
                            res.statusCode
                        )
                    );

                }

            }
        );



        ws.on("error",(err)=>{

            if(!finished){

                finished=true;

                clearTimeout(timeout);

                reject(err);

            }

        });



        ws.on("close",()=>{

            if(!finished){

                finished=true;

                clearTimeout(timeout);

                reject(
                    new Error(
                        "Connection closed"
                    )
                );

            }

        });

    });

}




app.get("/",async(req,res)=>{


    const query=req.query.id;


    if(!query){

        return res.json({

            error:
            "Use ?id=element"

        });

    }



    const offset=req.query.offset || 0;

    const sort=req.query.sort || "time";

    const order=req.query.order || "ascending";



    const key=JSON.stringify({
        query,
        offset,
        sort,
        order
    });



    if(cache.has(key)){

        return res.json(
            cache.get(key)
        );

    }



    try{


        const items=
        await connectInfini(
            query,
            offset,
            sort,
            order
        );



        const result={

            query,

            offset:Number(offset),

            count:items.length,

            items

        };



        cache.set(
            key,
            result
        );


        // limit cache size
        if(cache.size>1000){

            cache.delete(
                cache.keys().next().value
            );

        }



        res.json(result);



    }
    catch(err){


        console.error(err);


        res.status(500).json({

            error:err.message,

            hint:
            "InfiniBrowser may be blocking server-side websocket clients"

        });


    }


});



app.listen(PORT,()=>{

    console.log(
        "API running on port "+PORT
    );

});
