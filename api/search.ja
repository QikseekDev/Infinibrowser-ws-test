import WebSocket from "ws";

export default async function handler(req, res) {

    const id = req.query.id;

    if (!id) {
        return res.status(400).json({
            error: "Missing ?id="
        });
    }


    const items = await new Promise((resolve, reject)=>{

        const ws = new WebSocket(
            "wss://infinibrowser.wiki/api/ws"
        );


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
                        query:id,
                        sort:"time",
                        order:"ascending"
                    }
                }));

            },300);

        });


        ws.on("message", data=>{

            const msg=JSON.parse(data);


            if(msg.op==="search"){
                resolve(msg.data.items);
                ws.close();
            }

        });


        ws.on("error", reject);


        setTimeout(()=>{
            reject(new Error("Timeout"));
            ws.close();
        },10000);

    });


    res.json({
        query:id,
        items
    });
}
