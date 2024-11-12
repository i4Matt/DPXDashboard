import sys
import time
import pyautogui

if __name__ == "__main__":
    # Check which function to call based on the argument passed

    if len(sys.argv) > 1:
        function_name = sys.argv[1]

        if function_name == "sing16by9()":
            time.sleep(5)
            pyautogui.write('a')

        elif function_name == "doub16by9()":
            pyautogui.write('a')

        elif function_name == "trio16by9()":
            pyautogui.write('a')

        elif function_name == "quad16by9()":
            pyautogui.write('a')

    else:
        print("No function name passed.")