import React, { useEffect } from "react";
import { backendFetch } from "./common/BackendCall";
import { Button, Checkbox, Dialog, DialogTitle, FormControlLabel, MenuItem, Select, TextField } from "@mui/material";
import Blockie from "./Blockie";
import { Alias } from "./logic/Alias";
import "./Aliases.css";

interface SimpleDialogProps {
    open: boolean;
    selectedValue: string;
    onClose: (value: string) => void;
}

const listCategories = [
    {
        value: "producer",
        label: "Producer",
    },
    {
        value: "owned",
        label: "Owned",
    },
    {
        value: "wallet",
        label: "Wallet",
    },
    {
        value: "spam",
        label: "Spam",
    },
    {
        value: "other",
        label: "Other",
    },
];

function SimpleDialog(props: SimpleDialogProps) {
    const { onClose, selectedValue, open } = props;

    const handleClose = () => {
        onClose(selectedValue);
    };

    const handleListItemClick = (value: string) => {
        onClose(value);
    };

    return (
        <Dialog onClose={handleClose} open={open}>
            <DialogTitle>Set backup account</DialogTitle>
            <Button onClick={() => handleListItemClick("test")}>test</Button>
        </Dialog>
    );
}

interface DeleteDialogProps {
    open: boolean;
    address: string;
    aliases: Alias[];
    onConfirmDelete: (value: string | null) => void;
}

function DeleteAccountDialog(props: DeleteDialogProps) {
    const alias = props.aliases.find((alias) => alias.address === props.address);
    return (
        <Dialog open={props.open} onClose={() => props.onConfirmDelete(null)}>
            <div className={"add-new-alias"}>
                <h3>Delete alias for account</h3>
                <div className={"address-field"}>
                    <Blockie address={props.address}></Blockie>
                    <div className={"address-field-content"}>
                        <div className={"address-field-label"}>
                            {alias?.name ?? "Unknown"} ({alias?.category ?? "Unknown"})
                        </div>
                        <div className={"address-field-short-address"}>{props.address}</div>
                    </div>
                </div>

                <div className={"bottom-button-delete-account"}>
                    <Button
                        title={"Confirm"}
                        sx={{ marginRight: 2 }}
                        onClick={() => props.onConfirmDelete(props.address)}
                    >
                        <img src={"/dashboard/uxwing/save-icon.svg"} />
                    </Button>
                    <Button title={"Cancel"} onClick={() => props.onConfirmDelete(null)}>
                        <img src={"/dashboard/uxwing/remove-icon.svg"} />
                    </Button>
                </div>
            </div>
        </Dialog>
    );
}

const Aliases = () => {
    const [open, setOpen] = React.useState(false);
    const [selectedValue, setSelectedValue] = React.useState("test");
    const [isDeleting, setIsDeleting] = React.useState<boolean>(false);
    const [deletedAccount, setDeletedAccount] = React.useState<string | null>(null);
    const [isAddingNew, setIsAddingNew] = React.useState(false);
    const [displayOther, setDisplayOther] = React.useState(true);
    const [displayOwned, setDisplayOwned] = React.useState(true);
    const [displayProducer, setDisplayProducer] = React.useState(true);
    const [displaySpam, setDisplaySpam] = React.useState(true);
    const [displayWallet, setDisplayWallet] = React.useState(true);

    const [newName, setNewName] = React.useState("null");
    const [newAddress, setNewAddress] = React.useState("0x0000000000000000000000000000000000000000");
    const [newCategory, setNewCategory] = React.useState("producer");
    const [aliases, setAliases] = React.useState<Alias[]>([]);
    const [frontendAliases, setFrontendAliases] = React.useState<Alias[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [aliasError, setAliasError] = React.useState("");
    const [reloadNo, setReloadNo] = React.useState(0);
    const getAliases = async () => {
        setLoading(true);
        try {
            const response = await backendFetch("/api/scan/aliases", {
                method: "Get",
            });
            if (response.status !== 200) {
                setAliases([]);
                setFrontendAliases([]);
                setAliasError("Error fetching aliases");
                setLoading(false);
                return;
            }
            const data = await response.json();
            setAliases(structuredClone(data));
            setFrontendAliases(data);
        } catch (_e) {
            setAliases([]);
            setFrontendAliases([]);
            setAliasError("Error fetching aliases");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        getAliases().then();
    }, [reloadNo]);

    async function commitDelete(address: string) {
        frontendAliases.map((alias, idx) => {
            if (alias.address === address) {
                frontendAliases.splice(idx, 1);
            }
        });
        await saveAliases([...frontendAliases]);
    }
    function handleEdit(address: string) {
        frontendAliases.map((alias) => {
            if (alias.address !== address) {
                alias.edit = false;
            } else {
                alias.edit = true;
            }
        });
        setFrontendAliases([...frontendAliases]);
    }
    function handleCancel() {
        setIsAddingNew(false);
        setFrontendAliases(structuredClone(aliases));
    }
    async function saveAliases(newAliases: Alias[]) {
        setLoading(true);
        const response = await backendFetch("/api/scan/aliases", {
            method: "Post",
            body: JSON.stringify({
                newAliases: newAliases,
                oldAliases: aliases,
            }),
        });
        const data = await response.text();

        setDeletedAccount(null);
        if (response.status !== 200) {
            setAliasError(data);
            setLoading(false);
            return;
        }
        console.log(data);

        setReloadNo(reloadNo + 1);
        setLoading(false);
    }

    async function handleSave() {
        setLoading(true);
        const response = await backendFetch("/api/scan/aliases", {
            method: "Post",
            body: JSON.stringify({
                newAliases: frontendAliases,
                oldAliases: aliases,
            }),
        });
        const data = await response.text();

        if (response.status !== 200) {
            setAliasError(data);
            setLoading(false);
            return;
        }
        console.log(data);

        setReloadNo(reloadNo + 1);
        setLoading(false);
    }

    function updateName(address: string, name: string) {
        frontendAliases.map((alias) => {
            if (alias.address === address) {
                alias.name = name;
            }
        });
        setFrontendAliases([...frontendAliases]);
    }

    function updateCategory(address: string, category: string) {
        frontendAliases.map((alias) => {
            if (alias.address === address) {
                alias.category = category;
            }
        });
        setFrontendAliases([...frontendAliases]);
    }

    const renderRow = (idx: number, alias: Alias) => {
        return (
            <tr key={alias.address}>
                <td>
                    <Blockie address={alias.address} />
                </td>

                <td>
                    <a href={`https://etherscan.io/address/${alias.address}`}>{alias.address}</a>
                </td>
                <td>
                    {alias.edit ? (
                        <input value={alias.name} onChange={(e) => updateName(alias.address, e.target.value)} />
                    ) : (
                        <>{alias.name}</>
                    )}
                </td>
                <td>
                    {alias.edit ? (
                        <select value={alias.category} onChange={(e) => updateCategory(alias.address, e.target.value)}>
                            {listCategories.map((category) => (
                                <option key={category.value} value={category.value}>
                                    {category.label}
                                </option>
                            ))}
                        </select>
                    ) : (
                        <>{listCategories.find((e) => e.value == alias.category)?.label ?? alias.category}</>
                    )}
                </td>
                <td>
                    {alias.edit ? (
                        <>
                            <Button title={"Confirm"} onClick={() => handleSave()}>
                                <img src={"/dashboard/uxwing/save-icon.svg"} />
                            </Button>
                            <Button title={"Cancel"} onClick={() => handleCancel()}>
                                <img src={"/dashboard/uxwing/remove-icon.svg"} />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button onClick={() => handleEdit(alias.address)}>
                                <img src={"/dashboard/uxwing/edit-icon.svg"} />
                            </Button>
                            <Button
                                onClick={() => {
                                    setDeletedAccount(alias.address);
                                    setIsDeleting(true);
                                }}
                            >
                                <img style={{ width: 40 }} src={"/dashboard/uxwing/recycle-bin-line-icon.svg"} />
                            </Button>
                        </>
                    )}
                </td>
            </tr>
        );
    };

    async function handleNewEntry() {
        if (frontendAliases.find((alias) => alias.address === newAddress)) {
            setAliasError("Address already exists");
            return;
        }
        const newFrontendAliases = [
            {
                address: newAddress,
                name: newName,
                category: newCategory,
                edit: false,
            },
            ...frontendAliases,
        ];

        await saveAliases(newFrontendAliases);
        setIsAddingNew(false);
    }

    const handleClose = (value: string) => {
        setOpen(false);
        setSelectedValue(value);
    };

    const handleConfirmDelete = async (value: string | null) => {
        if (value) {
            setIsDeleting(false);
            await commitDelete(value);
        } else {
            setIsDeleting(false);
        }
    };

    const displayAliases = [];
    for (const alias of frontendAliases) {
        if (alias.edit) {
            displayAliases.push(alias);
            continue;
        }
        if (alias.category === "other" && !displayOther) {
            continue;
        }
        if (alias.category === "owned" && !displayOwned) {
            continue;
        }
        if (alias.category === "producer" && !displayProducer) {
            continue;
        }
        if (alias.category === "spam" && !displaySpam) {
            continue;
        }
        if (alias.category === "wallet" && !displayWallet) {
            continue;
        }
        displayAliases.push(alias);
    }

    return (
        <div className={"content-main"}>
            <SimpleDialog selectedValue={selectedValue} open={open} onClose={handleClose} />
            <DeleteAccountDialog
                open={isDeleting}
                address={deletedAccount ?? ""}
                aliases={aliases}
                onConfirmDelete={handleConfirmDelete}
            ></DeleteAccountDialog>

            <div className={"content-header-selection"}>
                <div className={"content-subtitle"}>LIST OF ETH WALLET ALIASES</div>

                <Button onClick={() => setIsAddingNew(true)}>
                    <img style={{ width: 40 }} src={"/dashboard/uxwing/plus-line-icon.svg"} />
                </Button>
                {loading && <div>Loading...</div>}
                <div style={{ flexGrow: 1 }}></div>
            </div>

            <div className={"transaction-display-filters"}>
                <div>
                    <FormControlLabel
                        control={
                            <Checkbox checked={displayOther} onChange={(e) => setDisplayOther(e.target.checked)} />
                        }
                        label="Other"
                    />
                </div>
                <div>
                    <FormControlLabel
                        control={
                            <Checkbox checked={displayOwned} onChange={(e) => setDisplayOwned(e.target.checked)} />
                        }
                        label="Owned"
                    />
                </div>

                <div>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={displayProducer}
                                onChange={(e) => setDisplayProducer(e.target.checked)}
                            />
                        }
                        label="Producer"
                    />
                </div>

                <div>
                    <FormControlLabel
                        control={<Checkbox checked={displaySpam} onChange={(e) => setDisplaySpam(e.target.checked)} />}
                        label="Spam"
                    />
                </div>

                <div>
                    <FormControlLabel
                        control={
                            <Checkbox checked={displayWallet} onChange={(e) => setDisplayWallet(e.target.checked)} />
                        }
                        label="Wallet"
                    />
                </div>
            </div>

            <div className={"error-msg"}>{aliasError}</div>

            <div>
                <table className={"alias-table"}>
                    <thead>
                        <tr>
                            <th>Blockie</th>
                            <th>Address</th>
                            <th>Name</th>
                            <th>Category</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                </table>
            </div>

            <table className={"alias-table"}>
                <tbody>
                    {displayAliases.map((alias, idx) => {
                        return renderRow(idx, alias);
                    })}
                </tbody>
            </table>
            <div className={"blocks-export-row"}>
                Displaying {displayAliases.length} aliases of {aliases.length}
            </div>
            <Dialog open={isAddingNew}>
                <div className={"add-new-alias"}>
                    <h3>New entry box</h3>
                    <div>
                        <TextField
                            slotProps={{
                                inputLabel: {
                                    shrink: true,
                                },
                            }}
                            label={"New name"}
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                        />
                    </div>
                    <div>
                        <TextField
                            slotProps={{
                                inputLabel: {
                                    shrink: true,
                                },
                            }}
                            sx={{
                                width: 420,
                            }}
                            label={"New address"}
                            type={"text"}
                            value={newAddress}
                            onChange={(e) => setNewAddress(e.target.value)}
                        />
                        <Blockie address={newAddress} />
                    </div>
                    <div>
                        <Select
                            sx={{ width: 150 }}
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                        >
                            {listCategories.map((category) => (
                                <MenuItem key={category.value} value={category.value}>
                                    {category.label}
                                </MenuItem>
                            ))}
                        </Select>
                    </div>

                    <div>
                        <Button title={"Confirm"} sx={{ marginRight: 2 }} onClick={() => handleNewEntry()}>
                            <img src={"/dashboard/uxwing/save-icon.svg"} />
                        </Button>
                        <Button title={"Cancel"} onClick={() => handleCancel()}>
                            <img src={"/dashboard/uxwing/remove-icon.svg"} />
                        </Button>
                    </div>
                </div>
            </Dialog>
        </div>
    );
};

export default Aliases;
