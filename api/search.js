import WebSocket from "ws";

const cache = new Map();


function connectInfini(searchData) {

    return new Promise((resolve, reject) => {

        let finished = false;
        let ws;


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

        }, 15000);



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



        ws.on("open", () => {


            ws.send(JSON.stringify({

                op: "identify",

                data: {

                    client:
                        "InfiniBrowser/1.6",

                    version: 2,

                    token: null

                }

            }));



            setTimeout(() => {


                ws.send(JSON.stringify({

                    op: "search",

                    nonce: 1,

                    data: searchData

                }));


            }, 500);


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



            if (
                msg.op === "search" &&
                msg.data?.items &&
                !finished
            ) {


                finished = true;


                clearTimeout(timeout);


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


                reject(err);


            }


        });





        ws.on("close", () => {


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



    let searchData;



    if (selectedSort === "time") {


        searchData = {

            offset:
                Number(offset) || 0,


            internal_offset:
                Number(internal_offset) || 0,


            query:
                String(id || ""),


            sort:
                "time",


            order:
                order || "ascending"

        };


    } else {


        searchData = {

            offset:
                Number(offset) || 0,


            internal_offset:
                Number(internal_offset) || 0,


            before:
                Math.floor(
                    Date.now() / 1000
                ),


            query:
                String(id || ""),


            sort:
                selectedSort,


            order:
                order || "ascending"

        };


    }




    console.log(
        "Sending:",
        JSON.stringify(searchData)
    );



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
