import WebSocket from "ws";

const cache = new Map();

let ws = null;
let ready = false;
let connecting = null;

let nonce = 0;

const pending = new Map();



function createConnection() {

    if (connecting)
        return connecting;


    connecting = new Promise((resolve, reject) => {

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


        let verified = false;
        let identified = false;


        const timeout = setTimeout(() => {

            if (!ready) {

                ws?.close();

                connecting = null;

                reject(
                    new Error(
                        "Handshake timeout"
                    )
                );

            }

        }, 15000);



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


            setInterval(() => {

                if (
                    ws &&
                    ws.readyState === WebSocket.OPEN
                ) {

                    ws.send(JSON.stringify({
                        op: "heartbeat"
                    }));

                }

            }, 5000);


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


            console.log("INF:", msg);



            if (
                msg.op === "verify" &&
                msg.data?.ok
            ) {

                verified = true;

            }



            if (
                msg.op === "identify" &&
                msg.data?.latest_version
            ) {

                identified = true;

            }



            if (
                verified &&
                identified &&
                !ready
            ) {

                ready = true;

                clearTimeout(timeout);

                connecting = null;

                resolve();

            }



            if (
                msg.op === "search" &&
                msg.data?.items
            ) {


                const request =
                    pending.get(
                        msg.nonce
                    );


                if (request) {

                    pending.delete(
                        msg.nonce
                    );

                    request.resolve(
                        msg.data.items
                    );

                }

            }


        });



        ws.on("close", () => {

            ready = false;
            ws = null;
            connecting = null;


            for (const item of pending.values()) {

                item.reject(
                    new Error(
                        "WebSocket closed"
                    )
                );

            }


            pending.clear();

        });



        ws.on("error", err => {

            console.error(err);

        });


    });


    return connecting;

}





async function searchInfini(data) {

    await createConnection();


    return new Promise((resolve, reject) => {


        const id = ++nonce;


        pending.set(
            id,
            {
                resolve,
                reject
            }
        );



        ws.send(JSON.stringify({

            op: "search",

            nonce: id,

            data

        }));


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



    const key =
        JSON.stringify(searchData);



    if (cache.has(key)) {

        return res.json(
            cache.get(key)
        );

    }




    try {


        const items =
            await searchInfini(
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



        res.json(result);



    } catch (err) {


        res.status(500).json({

            error:
                err.message

        });


    }

}
