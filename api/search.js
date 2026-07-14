import WebSocket from "ws";

const cache = new Map();


function connectInfini(searchData) {

    return new Promise((resolve, reject) => {

        let finished = false;
        let searched = false;
        let nonce = 0;
        let heartbeatTimer;

        let ws;


        function nextNonce() {
            nonce++;
            return nonce;
        }



        const timeout = setTimeout(() => {

            if (!finished) {

                finished = true;

                try {
                    ws?.close();
                } catch {}

                reject(
                    new Error("InfiniBrowser timeout")
                );

            }

        }, 20000);




        ws = new WebSocket(
            "wss://infinibrowser.wiki/api/ws",
            {
                headers: {
                    Origin:
                        "https://infinibrowser.wiki",

                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                }
            }
        );





        ws.on("open", () => {


            heartbeatTimer = setInterval(() => {

                if (
                    ws.readyState === WebSocket.OPEN
                ) {

                    ws.send(JSON.stringify({
                        op: "heartbeat"
                    }));

                }

            }, 5000);




            ws.send(JSON.stringify({

                op: "identify",

                data: {

                    client:
                        "InfCraftBrowser/1.6",

                    version: 2,

                    token: null

                }

            }));

        });






        ws.on("message", raw => {


            let msg;


            try {

                msg =
                    JSON.parse(
                        raw.toString()
                    );

            } catch {

                return;

            }





            if (msg.op === "verify") {


                ws.send(JSON.stringify({

                    op: "verify",

                    data: {

                        token:
                            msg.data.token

                    }

                }));

                return;

            }





            if (msg.op === "heartbeat") {

                return;

            }





            if (
                msg.op === "identify" &&
                msg.data?.latest_version &&
                !searched
            ) {


                searched = true;


                const payload = {

                    op: "search",

                    nonce:
                        nextNonce(),

                    data:
                        searchData

                };


                console.log(
                    "Sending:",
                    JSON.stringify(payload)
                );


                ws.send(
                    JSON.stringify(payload)
                );


                return;

            }





            if (
                msg.op === "search" &&
                msg.data?.items &&
                !finished
            ) {


                finished = true;


                clearTimeout(timeout);


                clearInterval(
                    heartbeatTimer
                );


                resolve(
                    msg.data
                );


                try {
                    ws.close();
                } catch {}


            }


        });







        ws.on("error", err => {


            if (!finished) {


                finished = true;


                clearTimeout(timeout);


                clearInterval(
                    heartbeatTimer
                );


                reject(err);


            }


        });







        ws.on("close", () => {


            clearInterval(
                heartbeatTimer
            );


            if (!finished) {


                finished = true;


                clearTimeout(timeout);


                reject(
                    new Error("Connection closed")
                );


            }


        });


    });

}







export default async function handler(req, res) {


    res.setHeader(
        "Access-Control-Allow-Origin",
        "*"
    );



    const {

        id,

        offset,

        internal_offset,

        sort,

        order

    } = req.query;



    const selectedSort =
        sort || "time";




    const searchData = {


        offset:
            Number(offset) || 0,


        internal_offset:
            Number(internal_offset) || 0,



        ...(selectedSort !== "time"
            ? {
                before:
                    Math.floor(
                        Date.now() / 1000
                    )
            }
            : {}),



        query:
            String(id || ""),



        sort:
            selectedSort,



        order:
            order || "ascending"


    };





    const key =
        JSON.stringify(searchData);




    if (cache.has(key)) {


        return res.json(
            cache.get(key)
        );


    }





    try {


        const reply =
            await connectInfini(
                searchData
            );



        const result = {


            query:
                searchData.query,


            offset:
                searchData.offset,


            count:
                reply.items?.length || 0,


            items:
                reply.items || []

        };





        cache.set(
            key,
            result
        );




        if (cache.size > 1000) {

            cache.delete(
                cache.keys().next().value
            );

        }





        return res.json(result);




    } catch (err) {


        console.error(err);


        return res.status(500).json({

            error:
                err.message,


            sent:
                searchData

        });


    }

}
