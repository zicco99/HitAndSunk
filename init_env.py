import os
import subprocess


def get_input_with_default(prompt, default):
    user_input = input(prompt)
    if user_input.strip() and user_input != "d":
        return user_input.strip()
    return default


def run_command(command, cwd=None):
    result = subprocess.run(command, shell=True,
                            capture_output=True, text=True, cwd=cwd)
    
    if(command!="npm install"):
        if result.returncode == 0:
            print("Command executed successfully.")
            if result.stdout:
                print("Output:")
                print(result.stdout)
        else:
            print("Command execution failed.")
            if result.stderr:
                print("Error:")
                print(result.stderr)
    else:
        print("npm istalled")


def init_contract_env():
    print("Config Phase 1: Configure Truffle with Ganache, compile, and deploy the contract")

    contract_folder = './src/contract/deploy'

    # Accept user input for network configuration
    host = get_input_with_default(
        "Enter the IP address of your node (default: 127.0.0.1): ", "127.0.0.1")
    port = get_input_with_default(
        "Enter the port number of your node (default: 7545): ", "7545")
    network_id = get_input_with_default(
        "Enter the network ID of your private network (default: 5777): ", "5777")
    from_address = get_input_with_default(
        "Enter the deployer address (default: eBA23Ff92Ca2Cb819921e9cD98924B7D252689ed): ",
        "eBA23Ff92Ca2Cb819921e9cD98924B7D252689ed")
    gas_limit = get_input_with_default(
        "Enter the gas limit for deployments (default: 6721975): ", "6721975")
    gas_price = get_input_with_default(
        "Enter the gas price in Wei (default: 20000000000): ", "20000000000")

    # Format the user input into the JavaScript code
    file_content = f"""module.exports = {{
    networks: {{
        development: {{
        host: "{host}",
        port: "{port}",
        network_id: "{network_id}",
        from: "{from_address}",
        gas: {gas_limit},
        gasPrice: {gas_price},
        }},
    }},
    compilers: {{
        solc: {{
        version: "0.8.9",
        }},
    }},
}};
"""

    file_path = os.path.join(contract_folder, 'truffle-config.js')

    with open(file_path, "w") as file:
        file.write(file_content)

    print(
        f"The Truffle config file has been created and set successfully in {contract_folder}.")

    run_command("npm install",cwd=contract_folder)
    run_command("truffle deploy",cwd=contract_folder)

    print("Config Phase 2: you have to manually configure configFile.js\n")

    print(
        f"The Provider URL in the configFile.js in [{contract_folder}] will be: ws://{host}:{port}")
    print("Web socket will be used to enable Ganache event subscriptions.\n")

    print("Please update the configFile with the above provided data and insert the private key of a rich account (account1SK) and 3 other accounts chosen from Ganache.")
    print("  -If you execute terminal tests, almost all the accounts will be used.")
    print("  -If you use a React DAPP instead, account1SK will be used to fund brand-new accounts.\n")


def init_dapp_env():
    run_command("cd ../../")
    run_command("npm install")


if __name__ == "__main__":
    init_contract_env()
    init_dapp_env()
    print("In the end:")
    print("  -If you execute terminal test, 'node /src/contract/test/test.js'")
    print("  -If you use a React DAPP instead, 'npm start'")
