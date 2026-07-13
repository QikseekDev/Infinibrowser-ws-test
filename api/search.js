import WebSocket from "ws";

export default async function handler(req, res) {

    const id = req.query.id;

    if (!id) {
        return res.status(400).json({
            error: "Missing id parameter"
        });
    }


    try {

        const items = await search(id);

        return res.status(200).json({
            query: id,
            items
        });


    } catch (err) {

        console.error(err);

        return res.status(500).json({
            error: err.message
        });

    }
}



function search(query) {

    return new Promise((resolve, reject)=>{

        let finished = false;


        const ws = new WebSocket(
            "wss://infinibrowser.wiki/api/ws"
        );


        const timeout = setTimeout(()=>{
            if(!finished){
                finished=true;
                ws.close();
                reject(new Error("WebSocket timeout"));
            }
        },15000);



        ws.on("open", ()=>{

            console.log("WS connected");


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
                        query:query,
                        sort:"time",
                        order:"ascending"
                    }
                }));

            },500);

        });



        ws.on("message", data=>{

            let msg;

            try {
                msg = JSON.parse(data.toString());
            }
            catch {
                console.log("Non JSON:", data.toString());
                return;
            }


            console.log(msg.op);


            if(msg.op === "search" && !finished){

                finished=true;

                clearTimeout(timeout);

                resolve(
                    msg.data?.items || []
                );

                ws.close();

            }

        });



        ws.on("error", err=>{

            if(!finished){

                finished=true;

                clearTimeout(timeout);

                reject(err);

            }

        });


        ws.on("close", ()=>{

            if(!finished){

                finished=true;

                clearTimeout(timeout);

                reject(
                    new Error("WebSocket closed")
                );

            }

        });

    });

}
