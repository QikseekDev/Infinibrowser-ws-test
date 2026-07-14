import WebSocket from "ws";

const cache = new Map();


function connectInfini(searchData) {

    return new Promise((resolve, reject) => {

        let finished = false;
        let searched = false;

        let nonce = 0;

        let verified = false;
        let identified = false;

        let heartbeatTimer;

        let ws;


        function log(...args) {
            console.log("[Infini]", ...args);
        }


        function send(data) {

            log(
                "SEND:",
                JSON.stringify(data)
            );

            ws.send(
                JSON.stringify(data)
            );

        }


        function nextNonce() {

            nonce++;

            log(
                "NONCE:",
                nonce
            );

            return nonce;

        }



        function trySearch() {

            log(
                "trySearch state:",
                {
                    verified,
                    identified,
                    searched
                }
            );


            if (
                verified &&
                identified &&
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


                send(payload);

            }

        }





        const timeout = setTimeout(() => {

            if (!finished) {

                log(
                    "TIMEOUT. Last sent data:",
                    searchData
                );


                finished = true;


                clearInterval(
                    heartbeatTimer
                );


                try {
                    ws?.close();
                } catch {}


                reject(
                    new Error(
                        "InfiniBrowser timeout"
                    )
                );

            }

        }, 30000);






        log(
            "CONNECTING"
        );



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


            log(
                "OPEN"
            );



            heartbeatTimer =
                setInterval(() => {


                    if (
                        ws.readyState === WebSocket.OPEN
                    ) {

                        send({
                            op:"heartbeat"
                        });

                    }


                }, 5000);






            send({

                op:"identify",

                data:{

                    client:
                        "InfCraftBrowser/1.6",

                    version:
                        2,

                    token:
                        null

                }

            });


        });









        ws.on("message", raw => {


            log(
                "RAW:",
                raw.toString()
            );


            let msg;


            try {

                msg =
                    JSON.parse(
                        raw.toString()
                    );

            }

            catch(err) {

                log(
                    "JSON PARSE ERROR",
                    err
                );

                return;

            }



            log(
                "OP:",
                msg.op,
                "DATA:",
                msg.data
            );







            if (

                msg.op === "verify" &&
                msg.data?.token

            ) {


                log(
                    "VERIFY TOKEN RECEIVED"
                );


                send({

                    op:"verify",

                    data:{

                        token:
                            msg.data.token

                    }

                });


                return;

            }







            if (

                msg.op === "verify" &&
                msg.data?.ok

            ) {


                log(
                    "VERIFY OK"
                );


                verified = true;


                trySearch();


                return;

            }







            if (

                msg.op === "identify" &&
                msg.data?.latest_version

            ) {


                log(
                    "IDENTIFY VERSION:",
                    msg.data.latest_version
                );


                identified = true;


                trySearch();


                return;

            }







            if (

                msg.op === "search"

            ) {


                log(
                    "SEARCH RESPONSE",
                    msg.data
                );



                if (

                    msg.data?.items &&
                    !finished

                ) {


                    finished = true;


                    clearTimeout(
                        timeout
                    );


                    clearInterval(
                        heartbeatTimer
                    );



                    resolve(
                        msg.data
                    );



                    try {
                        ws.close();
                    }

                    catch {}

                }


            }



        });









        ws.on("error", err => {


            log(
                "ERROR:",
                err
            );


            if (!finished) {


                finished = true;


                clearTimeout(
                    timeout
                );


                clearInterval(
                    heartbeatTimer
                );


                reject(err);


            }


        });









        ws.on("close", code => {


            log(
                "CLOSE:",
                code
            );



            clearInterval(
                heartbeatTimer
            );



            if (!finished) {


                finished = true;


                clearTimeout(
                    timeout
                );


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

        before,

        sort,

        order

    } = req.query;








    const searchData = {


        offset:
            Number(offset) || 0,



        internal_offset:
            internal_offset !== undefined
                ? Number(internal_offset)
                : 0,



        before:
            before !== undefined
                ? Number(before)
                : Math.floor(
                    Date.now() / 1000
                ),



        query:
            String(id || ""),



        sort:
            sort || "time",



        order:
            order || "ascending"


    };





    console.log(
        "[API] Incoming request:",
        searchData
    );







    const key =
        JSON.stringify(searchData);





    if (
        cache.has(key)
    ) {


        console.log(
            "[CACHE] HIT"
        );


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





        if (
            cache.size > 1000
        ) {

            cache.delete(
                cache.keys().next().value
            );

        }





        return res.json(
            result
        );



    }

    catch(err) {


        console.error(
            "[API ERROR]",
            err
        );



        return res.status(500).json({

            error:
                err.message,


            sent:
                searchData

        });


    }


}
