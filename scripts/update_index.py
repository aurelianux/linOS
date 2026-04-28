#!/usr/bin/env python3
from update_index_lib import discover_services, write_services


def main():
    services = discover_services()
    write_services(services)


if __name__ == "__main__":
    main()
