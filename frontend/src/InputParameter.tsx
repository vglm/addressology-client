import React from "react";

interface InputParameter {
    name: string;
    type: string;
    value: string;
    setValue: (value: string) => void;
}

const InputParameter = (props: InputParameter) => {
    const [currValue, setCurrValue] = React.useState(props.value);
    const [validInfo, setValidationInfo] = React.useState("");

    const setCurrValue2 = (val: string) => {
        setCurrValue(val);
        if (props.type === "uint256") {
            try {
                const num = BigInt(val);
                if (num < 0) {
                    setValidationInfo("Value must be a positive number");
                    return;
                }

                setValidationInfo(`decimal: ${num} hex: 0x${num.toString(16).padStart(64, "0")}`);
            } catch (e) {
                setValidationInfo("Value must be a number");
            }
        }
        if (props.type === "address") {
            try {
                const num = BigInt(val);
                if (num < 0) {
                    setValidationInfo("Value must be a positive number");
                    return;
                }

                setValidationInfo(`decimal: ${num} hex: 0x${num.toString(16).padStart(64, "0")}`);
            } catch (e) {
                setValidationInfo("Value must be a number");
            }
        }

        props.setValue(val);
    };

    return (
        <tr>
            <td>{props.name}</td>
            <td>{props.type}</td>
            <td>
                <input type="text" value={currValue} onChange={(e) => setCurrValue2(e.target.value)}></input>
            </td>
            <td>{validInfo}</td>
        </tr>
    );
};
export default InputParameter;
