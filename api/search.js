import WebSocket from "ws";

const cache = new Map();

let nonceCounter = 0;


function connectInfini(searchData) {

    return new Promise((resolve, reject) => {

        let ws;
        let finished = false;
        let stage = 0;
        let heartbeat;


        const timeout = setTimeout(() => {

            if (!finished) {

                finished = true;

                try {
                    ws.close();
                } catch {}

                clearInterval(heartbeat);

                reject(
                    new Error("InfiniBrowser timeout")
                );
            }

        }, 20000);



        ws = new WebSocket(
            "wss://infinibrowser.wiki/api/ws",
            {
                headers: {
                    Origin: "https://infinibrowser.wiki",
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                }
            }
        );



        heartbeat = setInterval(() => {

            if (
                ws.readyState === WebSocket.OPEN
            ) {

                ws.send(JSON.stringify({
                    op: "heartbeat"
                }));

            }

        }, 5000);




        ws.on("open", () => {

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

                msg = JSON.parse(
                    raw.toString()
                );

            } catch {

                return;

            }


            console.log("INF:", msg);



            // Identify complete
            if (

                msg.op === "identify" &&

                msg.data?.latest_version

            ) {


                ws.send(JSON.stringify({

                    op: "search",

                    nonce: ++nonceCounter,

                    data: {

                        offset: 0,

                        internal_offset: 0,

                        query:
                            searchData.query,

                        sort:
                            searchData.sort,

                        order:
                            searchData.order

                    }

                }));


                return;

            }





            // Search response
            if (

                msg.op === "search" &&

                msg.data?.items

            ) {


                // Fake initial page
                if (stage === 0) {

                    stage = 1;


                    ws.send(JSON.stringify({

                        op: "search",

                        nonce: ++nonceCounter,

                        data: searchData

                    }));


                    return;

                }




                if (!finished) {


                    finished = true;


                    clearTimeout(timeout);

                    clearInterval(heartbeat);


                    resolve(
                        msg.data.items
                    );


                    try {
                        ws.close();
                    } catch {}

                }

            }


        });




        ws.on("error", err => {

            if (!finished) {

                finished = true;

                clearTimeout(timeout);

                clearInterval(heartbeat);

                reject(err);

            }

        });




        ws.on("close", () => {

            if (!finished) {

                finished = true;

                clearTimeout(timeout);

                clearInterval(heartbeat);

                reject(
                    new Error(
                        "Connection closed"
                    )
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

        order,

        ...rest

    } = req.query;




    const searchData = {


        offset:

            offset !== undefined

                ? Number(offset)

                : 0,



        internal_offset:

            internal_offset !== undefined

                ? Number(internal_offset)

                : 0,



        query:

            String(id || ""),



        sort:

            sort || "time",



        order:

            order || "ascending",



        ...rest

    };




    const key = JSON.stringify(
        searchData
    );



    if (cache.has(key)) {

        return res.json(
            cache.get(key)
        );

    }





    try {


        const items = await connectInfini(
            searchData
        );



        const result = {

            query:
                searchData.query,

            offset:
                searchData.offset,

            internal_offset:
                searchData.internal_offset,

            sort:
                searchData.sort,

            order:
                searchData.order,

            count:
                items.length,

            items

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
