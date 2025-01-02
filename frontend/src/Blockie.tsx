import React from "react";

interface BlockieProps {
    address: string | null | undefined;
}

const BLOCKIE_SIZE = 60;

const Blockie = (props: BlockieProps) => {
    const address = props.address;
    if (!address) {
        return <div className="identicon"></div>;
    }
    return (
        <img
            style={{ width: BLOCKIE_SIZE, height: BLOCKIE_SIZE }}
            onClick={() => navigator.clipboard.writeText(address.toLowerCase())}
            title={"Click to copy address: " + address}
            className="identicon"
            src={`/api/scan/${props.address}/blockie/${BLOCKIE_SIZE}`}
        ></img>
    );
};

export default Blockie;
